package extension

import (
	"encoding/base64"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"extension-scaffold/internal/config"
	"extension-scaffold/internal/machine"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"
)

const (
	cleatCommitment = "0xa51b3a0d332331f538e09d16f67c2ef1cae1098f5451d2eb1b62e6b672684a96"
	cleatFinancier  = "0x1111111111111111111111111111111111111111"
)

func toHash(value string) common.Hash {
	return teeutils.ToHash(value)
}

func buildTestAction(opType, opCommand common.Hash, originalMessage []byte) teetypes.Action {
	return buildTestActionID("0x1234", opType, opCommand, originalMessage)
}

func buildTestActionID(id string, opType, opCommand common.Hash, originalMessage []byte) teetypes.Action {
	type dataFixed struct {
		InstructionID      common.Hash    `json:"instructionId"`
		TeeID              common.Address `json:"teeId"`
		Timestamp          uint64         `json:"timestamp"`
		RewardEpochID      uint32         `json:"rewardEpochId"`
		OPType             common.Hash    `json:"opType"`
		OPCommand          common.Hash    `json:"opCommand"`
		Cosigners          []string       `json:"cosigners"`
		CosignersThreshold uint64         `json:"cosignersThreshold"`
		OriginalMessage    hexutil.Bytes  `json:"originalMessage"`
	}

	message, _ := json.Marshal(dataFixed{
		InstructionID:   common.HexToHash(id),
		OPType:          opType,
		OPCommand:       opCommand,
		OriginalMessage: originalMessage,
	})
	return teetypes.Action{
		Data: teetypes.ActionData{
			ID:            common.HexToHash(id),
			SubmissionTag: "submit",
			Message:       message,
		},
	}
}

func sealedStore() *machine.Store {
	store := machine.NewStore()
	result := store.Seal(machine.SealRequest{
		InvoiceNumber: "INV-001",
		DebtorName:    "ACME",
		Currency:      "USD",
		AmountMinor:   "10000000",
		DueDate:       1788134400,
		Nonce:         "0x1111111111111111111111111111111111111111111111111111111111111111",
		Commitment:    cleatCommitment,
	})
	if !result.OK {
		panic("test seal failed: " + result.Detail)
	}
	store.CompleteRehydration()
	return store
}

func TestProcessAction_CleatRoutesStateMachine(t *testing.T) {
	extension := &Extension{cleat: sealedStore()}

	run := func(id, command string, payload any) teetypes.ActionResult {
		t.Helper()
		message, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		status, body := extension.processAction(buildTestActionID(
			id,
			toHash(config.OPTypeCleat),
			toHash(command),
			message,
		))
		if status != http.StatusOK {
			t.Fatalf("%s HTTP status=%d body=%s", command, status, body)
		}
		var result teetypes.ActionResult
		if err := json.Unmarshal(body, &result); err != nil {
			t.Fatalf("%s ActionResult: %v", command, err)
		}
		if result.Status != 1 {
			t.Fatalf("%s status=%d log=%s", command, result.Status, result.Log)
		}
		return result
	}

	check := run("0x101", config.OPCommandCheck, machine.CheckRequest{InvoiceCommitment: cleatCommitment})
	if _, _, verdict := decodeCleatResultData(t, check.Data); verdict != verdictClear {
		t.Fatalf("CHECK verdict=%d", verdict)
	}

	pledge := run("0x102", config.OPCommandPledge, machine.PledgeRequest{
		InvoiceCommitment: cleatCommitment,
		Financier:         cleatFinancier,
		Caller:            cleatFinancier,
	})
	if _, _, verdict := decodeCleatResultData(t, pledge.Data); verdict != verdictClear {
		t.Fatalf("PLEDGE verdict=%d", verdict)
	}

	status := run("0x103", config.OPCommandStatus, machine.StatusRequest{InvoiceCommitment: cleatCommitment})
	if _, _, verdict := decodeCleatResultData(t, status.Data); verdict != verdictAlreadyPledged {
		t.Fatalf("STATUS verdict=%d", verdict)
	}
	if strings.Contains(string(status.Data), "invoice") || strings.Contains(string(status.Data), "amount") {
		t.Fatalf("STATUS leaked invoice fields: %s", status.Data)
	}

	release := run("0x104", config.OPCommandRelease, machine.ReleaseRequest{
		InvoiceCommitment: cleatCommitment,
		Caller:            cleatFinancier,
		Outcome:           machine.OutcomeRepaid,
	})
	if _, _, verdict := decodeCleatResultData(t, release.Data); verdict != verdictReleased {
		t.Fatalf("RELEASE verdict=%d", verdict)
	}
}

func TestProcessAction_CleatAcceptsSolidityABIPayload(t *testing.T) {
	extension := &Extension{cleat: sealedStore()}
	message, err := cleatMessageArgs.Pack(
		common.HexToHash(cleatCommitment),
		common.HexToAddress(cleatFinancier),
		^uint64(0),
	)
	if err != nil {
		t.Fatal(err)
	}

	status, body := extension.processAction(buildTestActionID(
		"0xabc",
		toHash(config.OPTypeCleat),
		toHash(config.OPCommandPledge),
		message,
	))
	if status != http.StatusOK {
		t.Fatalf("HTTP status=%d body=%s", status, body)
	}
	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	requestID, commitment, verdict := decodeCleatResultData(t, result.Data)
	if requestID != common.HexToHash("0xabc") || commitment != common.HexToHash(cleatCommitment) || verdict != verdictClear {
		t.Fatalf("unexpected result request=%s commitment=%s verdict=%d", requestID, commitment, verdict)
	}
}

func TestProcessAction_CleatMalformedRequests(t *testing.T) {
	extension := &Extension{cleat: machine.NewStore()}
	for _, command := range []string{
		config.OPCommandCheck,
		config.OPCommandPledge,
		config.OPCommandRelease,
		config.OPCommandStatus,
	} {
		t.Run(command, func(t *testing.T) {
			status, body := extension.processAction(buildTestAction(
				toHash(config.OPTypeCleat),
				toHash(command),
				[]byte(`{"invoiceCommitment":`),
			))
			if status != http.StatusOK {
				t.Fatalf("HTTP status=%d body=%s", status, body)
			}
			var result teetypes.ActionResult
			if err := json.Unmarshal(body, &result); err != nil {
				t.Fatal(err)
			}
			if result.Status != 0 || !strings.Contains(result.Log, "decoding") {
				t.Fatalf("malformed %s result: %+v", command, result)
			}
		})
	}
}

func TestProcessAction_CleatRejectsRequestIDMismatch(t *testing.T) {
	payload, _ := json.Marshal(machine.CheckRequest{
		InvoiceCommitment: cleatCommitment,
		RequestID:         common.HexToHash("0xbeef").Hex(),
	})
	status, body := (&Extension{cleat: machine.NewStore()}).processAction(buildTestActionID(
		"0x1234",
		toHash(config.OPTypeCleat),
		toHash(config.OPCommandCheck),
		payload,
	))
	if status != http.StatusOK {
		t.Fatalf("HTTP status=%d body=%s", status, body)
	}
	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	if result.Status != 0 || !strings.Contains(result.Log, "requestId must match instructionId") {
		t.Fatalf("mismatched requestId result: %+v", result)
	}
}

func TestProcessAction_RejectsUnknownOperation(t *testing.T) {
	extension := &Extension{cleat: machine.NewStore()}
	status, body := extension.processAction(buildTestAction(toHash("GREETING"), toHash("SAY_HELLO"), nil))
	if status != http.StatusNotImplemented || !strings.Contains(string(body), config.OPTypeCleat) {
		t.Fatalf("unknown op type status=%d body=%s", status, body)
	}

	status, body = extension.processAction(buildTestAction(
		toHash(config.OPTypeCleat),
		toHash("UNKNOWN"),
		nil,
	))
	if status != http.StatusNotImplemented {
		t.Fatalf("unknown command status=%d body=%s", status, body)
	}
	for _, command := range []string{
		config.OPCommandCheck,
		config.OPCommandPledge,
		config.OPCommandRelease,
		config.OPCommandStatus,
	} {
		if !strings.Contains(string(body), command) {
			t.Fatalf("unknown command response omitted %s: %s", command, body)
		}
	}
}

func TestStateHandler_ReportsRehydration(t *testing.T) {
	store := machine.NewStore()
	store.CompleteRehydration()
	extension := &Extension{cleat: store}
	recorder := httptest.NewRecorder()

	extension.stateHandler(recorder, httptest.NewRequest(http.MethodGet, "/state", nil))

	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"rehydrated":true`) {
		t.Fatalf("state response status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestDecrypt_UsesTeeNodeSignPort(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		var payload decryptRequest
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		ciphertext, err := base64.StdEncoding.DecodeString(payload.EncryptedMessage)
		if err != nil || string(ciphertext) != "ciphertext" {
			http.Error(w, "unexpected ciphertext", http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(decryptResponse{
			DecryptedMessage: base64.StdEncoding.EncodeToString([]byte("plaintext")),
		})
	}))
	defer server.Close()

	parsed, _ := url.Parse(server.URL)
	_, portValue, _ := net.SplitHostPort(parsed.Host)
	port, _ := strconv.Atoi(portValue)
	plaintext, err := (&Extension{signPort: port}).decrypt([]byte("ciphertext"))
	if err != nil || string(plaintext) != "plaintext" {
		t.Fatalf("decrypt plaintext=%q err=%v", plaintext, err)
	}
}

func decodeCleatResultData(t *testing.T, data []byte) (common.Hash, common.Hash, uint8) {
	t.Helper()
	values, err := cleatResultArgs.Unpack(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 3 {
		t.Fatalf("result value count=%d", len(values))
	}
	requestID, ok := values[0].([32]byte)
	if !ok {
		t.Fatalf("request id type=%T", values[0])
	}
	commitment, ok := values[1].([32]byte)
	if !ok {
		t.Fatalf("commitment type=%T", values[1])
	}
	verdict, ok := values[2].(uint8)
	if !ok {
		t.Fatalf("verdict type=%T", values[2])
	}
	return common.Hash(requestID), common.Hash(commitment), verdict
}
