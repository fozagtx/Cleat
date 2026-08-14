package extension

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"extension-scaffold/internal/config"
	"extension-scaffold/internal/machine"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"

	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

type Extension struct {
	mu     sync.RWMutex
	Server *http.Server

	cleat    *machine.Store
	signPort int
}

type cleatMessage struct {
	Commitment common.Hash
	Financier  common.Address
	ValidUntil uint64
}

const (
	verdictInvalid        uint8 = 0
	verdictClear          uint8 = 1
	verdictAlreadyPledged uint8 = 2
	verdictReleased       uint8 = 3
	verdictDefaulted      uint8 = 4
	verdictCancelled      uint8 = 5
)

var (
	cleatMessageArgs = abi.Arguments{
		{Type: mustABIType("bytes32")},
		{Type: mustABIType("address")},
		{Type: mustABIType("uint64")},
	}
	cleatResultArgs = abi.Arguments{
		{Type: mustABIType("bytes32")},
		{Type: mustABIType("bytes32")},
		{Type: mustABIType("uint8")},
	}
)

// --- DO NOT MODIFY: New(), actionHandler() are boilerplate.
func New(extensionPort, signPort int) *Extension {
	// Cleat starts fail-closed. A chain rehydration integration must call
	// CompleteRehydration only after loading the authoritative registry snapshot.
	e := &Extension{cleat: machine.NewStore(), signPort: signPort}
	e.rehydrateFromChain()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /state", e.stateHandler)
	mux.HandleFunc("POST /action", e.actionHandler)

	e.Server = &http.Server{Addr: fmt.Sprintf(":%d", extensionPort), Handler: mux}
	return e
}

// stateHandler() structure is boilerplate but update the State field mapping to match your Extension fields.
func (e *Extension) stateHandler(w http.ResponseWriter, r *http.Request) {
	stateResponse := types.StateResponse{
		StateVersion: teeutils.ToHash(config.Version),
		State: types.State{
			Rehydrated: e.cleatStore().IsRehydrated(),
		},
	}

	err := json.NewEncoder(w).Encode(stateResponse)
	if err != nil {
		http.Error(w, fmt.Sprintf("sending response: %v", err), http.StatusInternalServerError)
		return
	}
}

func (e *Extension) processAction(action teetypes.Action) (int, []byte) {
	dataFixed, err := processorutils.Parse[instruction.DataFixed](action.Data.Message)
	if err != nil {
		return http.StatusBadRequest, []byte(fmt.Sprintf("decoding fixed data: %v", err))
	}

	if dataFixed.OPType == teeutils.ToHash(config.OPTypeCleat) {
		return e.processCleat(action, dataFixed)
	}
	return http.StatusNotImplemented, []byte(fmt.Sprintf(
		"unsupported op type: received %s, expected %s (%s)",
		dataFixed.OPType.Hex(),
		teeutils.ToHash(config.OPTypeCleat).Hex(), config.OPTypeCleat,
	))
}

// processCleat routes FCC Cleat instructions into the dual state machine.
func (e *Extension) processCleat(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	var result teetypes.ActionResult
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandSeal):
		plaintext, err := e.decrypt(df.OriginalMessage)
		if err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decrypting SEAL request: %w", err))
			break
		}
		var req machine.SealRequest
		if err := decodeStrict(plaintext, &req); err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decoding SEAL request: %w", err))
			break
		}
		outcome := e.cleatStore().Seal(req)
		if !outcome.OK {
			result = buildResult(action, df, nil, 0, fmt.Errorf("%s", outcome.Detail))
			break
		}
		data, _ := json.Marshal(outcome)
		result = buildResult(action, df, data, 1, nil)

	case df.OPCommand == teeutils.ToHash(config.OPCommandCheck):
		var req machine.CheckRequest
		wire, abiEncoded, err := decodeCleatMessage(df.OriginalMessage)
		if err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decoding CHECK request: %w", err))
			break
		}
		if abiEncoded {
			req = machine.CheckRequest{
				InvoiceCommitment: wire.Commitment.Hex(),
				ValidUntil:        int64(wire.ValidUntil),
			}
		} else if err := decodeStrict(df.OriginalMessage, &req); err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decoding CHECK request: %w", err))
			break
		}
		if err := bindRequestID(df, &req.RequestID); err != nil {
			result = buildResult(action, df, nil, 0, err)
			break
		}
		outcome := e.cleatStore().Check(req)
		result = buildCleatResult(action, df, commitmentHash(req.InvoiceCommitment), checkVerdict(outcome))

	case df.OPCommand == teeutils.ToHash(config.OPCommandPledge):
		var req machine.PledgeRequest
		wire, abiEncoded, err := decodeCleatMessage(df.OriginalMessage)
		if err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decoding PLEDGE request: %w", err))
			break
		}
		if abiEncoded {
			req = machine.PledgeRequest{
				Caller:            wire.Financier.Hex(),
				Financier:         wire.Financier.Hex(),
				InvoiceCommitment: wire.Commitment.Hex(),
				Role:              machine.RoleLender,
				ValidUntil:        int64(wire.ValidUntil),
			}
		} else if err := decodeStrict(df.OriginalMessage, &req); err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decoding PLEDGE request: %w", err))
			break
		}
		if err := bindRequestID(df, &req.RequestID); err != nil {
			result = buildResult(action, df, nil, 0, err)
			break
		}
		outcome := e.cleatStore().Pledge(req)
		result = buildCleatResult(action, df, commitmentHash(req.InvoiceCommitment), pledgeVerdict(outcome))

	case df.OPCommand == teeutils.ToHash(config.OPCommandRelease):
		var req machine.ReleaseRequest
		wire, abiEncoded, err := decodeCleatMessage(df.OriginalMessage)
		if err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decoding RELEASE request: %w", err))
			break
		}
		if abiEncoded {
			req = machine.ReleaseRequest{
				Caller:            wire.Financier.Hex(),
				InvoiceCommitment: wire.Commitment.Hex(),
				Outcome:           machine.OutcomeRepaid,
				Role:              machine.RoleLender,
			}
		} else if err := decodeStrict(df.OriginalMessage, &req); err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decoding RELEASE request: %w", err))
			break
		}
		if err := bindRequestID(df, &req.RequestID); err != nil {
			result = buildResult(action, df, nil, 0, err)
			break
		}
		outcome := e.cleatStore().Release(req)
		result = buildCleatResult(action, df, commitmentHash(req.InvoiceCommitment), releaseVerdict(outcome))

	case df.OPCommand == teeutils.ToHash(config.OPCommandStatus):
		var req machine.StatusRequest
		wire, abiEncoded, err := decodeCleatMessage(df.OriginalMessage)
		if err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decoding STATUS request: %w", err))
			break
		}
		if abiEncoded {
			req = machine.StatusRequest{
				Caller:            wire.Financier.Hex(),
				InvoiceCommitment: wire.Commitment.Hex(),
			}
		} else if err := decodeStrict(df.OriginalMessage, &req); err != nil {
			result = buildResult(action, df, nil, 0, fmt.Errorf("decoding STATUS request: %w", err))
			break
		}
		outcome := e.cleatStore().Status(req)
		result = buildCleatResult(action, df, commitmentHash(req.InvoiceCommitment), statusVerdict(outcome))

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected one of [%s, %s, %s, %s, %s]",
			df.OPCommand.Hex(),
			config.OPCommandSeal,
			config.OPCommandCheck,
			config.OPCommandPledge,
			config.OPCommandRelease,
			config.OPCommandStatus,
		))
	}

	body, _ := json.Marshal(result)
	return http.StatusOK, body
}

func (e *Extension) cleatStore() *machine.Store {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.cleat == nil {
		e.cleat = machine.NewStore()
	}
	return e.cleat
}

func decodeStrict(data []byte, dst any) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			return fmt.Errorf("multiple JSON values")
		}
		return err
	}
	return nil
}

func bindRequestID(df *instruction.DataFixed, requestID *string) error {
	if df.InstructionID == ([32]byte{}) {
		return fmt.Errorf("instructionId must not be empty")
	}
	canonical := df.InstructionID.Hex()
	if *requestID != "" && !strings.EqualFold(strings.TrimSpace(*requestID), canonical) {
		return fmt.Errorf("requestId must match instructionId")
	}
	*requestID = canonical
	return nil
}

func buildCleatResult(
	action teetypes.Action,
	df *instruction.DataFixed,
	commitment common.Hash,
	verdict uint8,
) teetypes.ActionResult {
	data, err := cleatResultArgs.Pack(df.InstructionID, commitment, verdict)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("encoding result: %w", err))
	}
	return buildResult(action, df, data, 1, nil)
}

func decodeCleatMessage(data []byte) (cleatMessage, bool, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return cleatMessage{}, false, fmt.Errorf("empty message")
	}
	if bytes.HasPrefix(bytes.TrimSpace(data), []byte("{")) {
		return cleatMessage{}, false, nil
	}

	values, err := cleatMessageArgs.Unpack(data)
	if err != nil {
		return cleatMessage{}, true, err
	}
	if len(values) != 3 {
		return cleatMessage{}, true, fmt.Errorf("expected 3 ABI values, got %d", len(values))
	}

	commitment, ok := values[0].([32]byte)
	if !ok {
		return cleatMessage{}, true, fmt.Errorf("invalid commitment ABI type")
	}
	financier, ok := values[1].(common.Address)
	if !ok {
		return cleatMessage{}, true, fmt.Errorf("invalid financier ABI type")
	}
	validUntil, ok := values[2].(uint64)
	if !ok {
		return cleatMessage{}, true, fmt.Errorf("invalid validUntil ABI type")
	}

	return cleatMessage{
		Commitment: common.Hash(commitment),
		Financier:  financier,
		ValidUntil: validUntil,
	}, true, nil
}

func checkVerdict(result machine.CheckResult) uint8 {
	switch result.Reason {
	case machine.CheckClear:
		return verdictClear
	case machine.CheckAlreadyPledged:
		return verdictAlreadyPledged
	default:
		return verdictInvalid
	}
}

func pledgeVerdict(result machine.PledgeResult) uint8 {
	if result.OK {
		return verdictClear
	}
	if result.Reason == machine.CheckAlreadyPledged {
		return verdictAlreadyPledged
	}
	return verdictInvalid
}

func releaseVerdict(result machine.ReleaseResult) uint8 {
	if !result.OK {
		return verdictInvalid
	}
	switch result.Financing {
	case machine.FinancingRepaid:
		return verdictReleased
	case machine.FinancingDefaulted:
		return verdictDefaulted
	case machine.FinancingCancelled:
		return verdictCancelled
	default:
		return verdictInvalid
	}
}

func statusVerdict(result machine.StatusResult) uint8 {
	if !result.OK {
		return verdictInvalid
	}
	switch result.PledgeStatus {
	case machine.PledgeUnpledged, machine.PledgeReleased:
		return verdictClear
	case machine.PledgeActive:
		return verdictAlreadyPledged
	default:
		return verdictInvalid
	}
}

func commitmentHash(value string) common.Hash {
	if len(strings.TrimPrefix(value, "0x")) != 64 {
		return common.Hash{}
	}
	return common.HexToHash(value)
}

func mustABIType(kind string) abi.Type {
	value, err := abi.NewType(kind, "", nil)
	if err != nil {
		panic(err)
	}
	return value
}
