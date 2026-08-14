package extension

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"extension-scaffold/internal/config"
	"extension-scaffold/internal/machine"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"
)

// toHash mirrors teeutils.ToHash for clarity: left-pads a string into a 32-byte hash.
func toHash(s string) common.Hash { return teeutils.ToHash(s) }

const (
	cleatCommitment = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	cleatFinancier  = "0x1111111111111111111111111111111111111111"
)

// buildTestAction constructs a teetypes.Action whose Data.Message is the
// JSON-encoded DataFixed payload. This is what processAction expects to parse.
func buildTestAction(opType, opCommand common.Hash, originalMessage []byte) teetypes.Action {
	return buildTestActionID("0x1234", opType, opCommand, originalMessage)
}

func buildTestActionID(id string, opType, opCommand common.Hash, originalMessage []byte) teetypes.Action {
	// DataFixed is the structure that processorutils.Parse extracts from Data.Message.
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

	df := dataFixed{
		InstructionID:   common.HexToHash(id),
		OPType:          opType,
		OPCommand:       opCommand,
		OriginalMessage: originalMessage,
	}
	msg, _ := json.Marshal(df)

	return teetypes.Action{
		Data: teetypes.ActionData{
			ID:            common.HexToHash(id),
			SubmissionTag: "submit",
			Message:       msg,
		},
	}
}

func TestProcessAction_CleatRoutesStateMachine(t *testing.T) {
	store := machine.NewStore()
	store.CompleteRehydration()
	e := &Extension{cleat: store}

	run := func(id, command string, payload any) teetypes.ActionResult {
		t.Helper()
		message, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		action := buildTestActionID(
			id,
			toHash(config.OPTypeCleat),
			toHash(command),
			message,
		)
		status, body := e.processAction(action)
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

func TestProcessAction_CleatAcceptsSolidityABIPayload(t *testing.T) {
	store := machine.NewStore()
	store.CompleteRehydration()
	e := &Extension{cleat: store}

	message, err := cleatMessageArgs.Pack(
		common.HexToHash(cleatCommitment),
		common.HexToAddress(cleatFinancier),
		^uint64(0),
	)
	if err != nil {
		t.Fatal(err)
	}
	action := buildTestActionID(
		"0xabc",
		toHash(config.OPTypeCleat),
		toHash(config.OPCommandPledge),
		message,
	)

	status, body := e.processAction(action)
	if status != http.StatusOK {
		t.Fatalf("HTTP status=%d body=%s", status, body)
	}
	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	if result.Status != 1 {
		t.Fatalf("status=%d log=%s", result.Status, result.Log)
	}
	requestID, commitment, verdict := decodeCleatResultData(t, result.Data)
	if requestID != common.HexToHash("0xabc") {
		t.Fatalf("request id=%s", requestID)
	}
	if commitment != common.HexToHash(cleatCommitment) {
		t.Fatalf("commitment=%s", commitment)
	}
	if verdict != verdictClear {
		t.Fatalf("verdict=%d", verdict)
	}
}

func TestProcessAction_CleatMalformedRequests(t *testing.T) {
	e := &Extension{cleat: machine.NewStore()}
	for _, command := range []string{
		config.OPCommandCheck,
		config.OPCommandPledge,
		config.OPCommandRelease,
		config.OPCommandStatus,
	} {
		t.Run(command, func(t *testing.T) {
			action := buildTestAction(
				toHash(config.OPTypeCleat),
				toHash(command),
				[]byte(`{"invoiceCommitment":`),
			)
			status, body := e.processAction(action)
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
	action := buildTestActionID(
		"0x1234",
		toHash(config.OPTypeCleat),
		toHash(config.OPCommandCheck),
		payload,
	)
	status, body := (&Extension{cleat: machine.NewStore()}).processAction(action)
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

// abiEncodeSayGoodbye produces the ABI-encoded tuple (string name, string reason)
// matching the Solidity SayGoodbyeMessage struct.
func abiEncodeSayGoodbye(name, reason string) []byte {
	args := abi.Arguments{types.SayGoodbyeMessageArg}
	type goodbye struct {
		Name   string
		Reason string
	}
	encoded, _ := args.Pack(goodbye{Name: name, Reason: reason})
	return encoded
}

// --- 4.1: OPType/OPCommand Hash Debug Info ---

func TestProcessAction_UnknownOPType(t *testing.T) {
	e := &Extension{}
	action := buildTestAction(
		toHash("UNKNOWN_TYPE"),
		toHash(config.OPCommandSayHello),
		nil,
	)

	status, body := e.processAction(action)

	if status != http.StatusNotImplemented {
		t.Fatalf("expected status %d, got %d", http.StatusNotImplemented, status)
	}

	bodyStr := string(body)
	t.Logf("501 body: %s", bodyStr)

	// Should contain "unsupported op type"
	if !contains(bodyStr, "unsupported op type") {
		t.Error("expected body to contain 'unsupported op type'")
	}

	// Should include the received hash
	receivedHash := toHash("UNKNOWN_TYPE").Hex()
	if !contains(bodyStr, receivedHash) {
		t.Errorf("expected body to contain received hash %s", receivedHash)
	}

	// Should include the expected hash
	expectedHash := toHash(config.OPTypeGreeting).Hex()
	if !contains(bodyStr, expectedHash) {
		t.Errorf("expected body to contain expected hash %s", expectedHash)
	}

	// Should include the human-readable name
	if !contains(bodyStr, config.OPTypeGreeting) {
		t.Errorf("expected body to contain %q", config.OPTypeGreeting)
	}
}

func TestProcessAction_UnknownOPCommand(t *testing.T) {
	e := &Extension{}
	action := buildTestAction(
		toHash(config.OPTypeGreeting),
		toHash("UNKNOWN_COMMAND"),
		nil,
	)

	status, body := e.processAction(action)

	if status != http.StatusNotImplemented {
		t.Fatalf("expected status %d, got %d", http.StatusNotImplemented, status)
	}

	bodyStr := string(body)
	t.Logf("501 body: %s", bodyStr)

	// Should contain "unsupported op command"
	if !contains(bodyStr, "unsupported op command") {
		t.Error("expected body to contain 'unsupported op command'")
	}

	// Should include the received hash
	receivedHash := toHash("UNKNOWN_COMMAND").Hex()
	if !contains(bodyStr, receivedHash) {
		t.Errorf("expected body to contain received hash %s", receivedHash)
	}

	// Should include both expected command hashes and names
	for _, cmd := range []string{config.OPCommandSayHello, config.OPCommandSayGoodbye} {
		cmdHash := toHash(cmd).Hex()
		if !contains(bodyStr, cmdHash) {
			t.Errorf("expected body to contain hash for %s: %s", cmd, cmdHash)
		}
		if !contains(bodyStr, cmd) {
			t.Errorf("expected body to contain command name %q", cmd)
		}
	}
}

// --- Valid Actions ---

func TestProcessAction_ValidSayHello(t *testing.T) {
	e := &Extension{}

	payload, _ := json.Marshal(types.SayHelloRequest{Name: "Alice"})
	action := buildTestAction(
		toHash(config.OPTypeGreeting),
		toHash(config.OPCommandSayHello),
		payload,
	)

	status, body := e.processAction(action)

	if status != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, status, body)
	}

	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("failed to unmarshal ActionResult: %v", err)
	}

	if result.Status != 1 {
		t.Fatalf("expected ActionResult.Status=1 (success), got %d: %s", result.Status, result.Log)
	}

	var resp types.SayHelloResponse
	if err := json.Unmarshal(result.Data, &resp); err != nil {
		t.Fatalf("failed to unmarshal SayHelloResponse: %v", err)
	}

	if resp.Greeting == "" {
		t.Error("expected non-empty greeting")
	}
	if resp.GreetingNumber != 1 {
		t.Errorf("expected GreetingNumber=1, got %d", resp.GreetingNumber)
	}
	if !contains(resp.Greeting, "Alice") {
		t.Errorf("expected greeting to contain 'Alice', got %q", resp.Greeting)
	}
	t.Logf("Response: %+v", resp)
}

func TestProcessAction_ValidSayGoodbye(t *testing.T) {
	e := &Extension{}

	payload := abiEncodeSayGoodbye("Bob", "leaving town")
	action := buildTestAction(
		toHash(config.OPTypeGreeting),
		toHash(config.OPCommandSayGoodbye),
		payload,
	)

	status, body := e.processAction(action)

	if status != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, status, body)
	}

	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("failed to unmarshal ActionResult: %v", err)
	}

	if result.Status != 1 {
		t.Fatalf("expected ActionResult.Status=1 (success), got %d: %s", result.Status, result.Log)
	}

	var resp types.SayGoodbyeResponse
	if err := json.Unmarshal(result.Data, &resp); err != nil {
		t.Fatalf("failed to unmarshal SayGoodbyeResponse: %v", err)
	}

	if resp.Farewell == "" {
		t.Error("expected non-empty farewell")
	}
	if resp.FarewellNumber != 1 {
		t.Errorf("expected FarewellNumber=1, got %d", resp.FarewellNumber)
	}
	if !contains(resp.Farewell, "Bob") {
		t.Errorf("expected farewell to contain 'Bob', got %q", resp.Farewell)
	}
	if !contains(resp.Farewell, "leaving town") {
		t.Errorf("expected farewell to contain 'leaving town', got %q", resp.Farewell)
	}
	t.Logf("Response: %+v", resp)
}

// --- Error Cases ---

func TestProcessSayHello_EmptyName(t *testing.T) {
	e := &Extension{}

	payload, _ := json.Marshal(types.SayHelloRequest{Name: ""})
	action := buildTestAction(
		toHash(config.OPTypeGreeting),
		toHash(config.OPCommandSayHello),
		payload,
	)

	status, body := e.processAction(action)

	if status != http.StatusOK {
		t.Fatalf("expected status %d (error is in ActionResult, not HTTP), got %d", http.StatusOK, status)
	}

	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result.Status != 0 {
		t.Fatalf("expected ActionResult.Status=0 (error), got %d", result.Status)
	}

	if !contains(result.Log, "name must not be empty") {
		t.Errorf("expected log to contain 'name must not be empty', got %q", result.Log)
	}
	t.Logf("Error log: %s", result.Log)
}

func TestProcessSayHello_InvalidJSON(t *testing.T) {
	e := &Extension{}

	action := buildTestAction(
		toHash(config.OPTypeGreeting),
		toHash(config.OPCommandSayHello),
		[]byte(`{invalid json`),
	)

	status, body := e.processAction(action)

	if status != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, status)
	}

	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result.Status != 0 {
		t.Fatalf("expected ActionResult.Status=0 (error), got %d", result.Status)
	}

	if !contains(result.Log, "decoding request") {
		t.Errorf("expected log to mention 'decoding request', got %q", result.Log)
	}
	t.Logf("Error log: %s", result.Log)
}

func TestProcessSayHello_UnknownFields(t *testing.T) {
	e := &Extension{}

	// DisallowUnknownFields is used in processSayHello — extra fields should fail
	action := buildTestAction(
		toHash(config.OPTypeGreeting),
		toHash(config.OPCommandSayHello),
		[]byte(`{"name":"Alice","extra":"field"}`),
	)

	status, body := e.processAction(action)

	if status != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, status)
	}

	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result.Status != 0 {
		t.Fatalf("expected ActionResult.Status=0 (error for unknown field), got %d", result.Status)
	}

	t.Logf("Error log: %s", result.Log)
}

func TestProcessSayGoodbye_EmptyName(t *testing.T) {
	e := &Extension{}

	payload := abiEncodeSayGoodbye("", "some reason")
	action := buildTestAction(
		toHash(config.OPTypeGreeting),
		toHash(config.OPCommandSayGoodbye),
		payload,
	)

	status, body := e.processAction(action)

	if status != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, status)
	}

	var result teetypes.ActionResult
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result.Status != 0 {
		t.Fatalf("expected ActionResult.Status=0 (error), got %d", result.Status)
	}

	if !contains(result.Log, "name must not be empty") {
		t.Errorf("expected log to contain 'name must not be empty', got %q", result.Log)
	}
	t.Logf("Error log: %s", result.Log)
}

// --- State Tracking ---

func TestProcessAction_GreetingCountIncrementsAcrossCalls(t *testing.T) {
	e := &Extension{}

	for i := 1; i <= 3; i++ {
		payload, _ := json.Marshal(types.SayHelloRequest{Name: "Counter"})
		action := buildTestAction(
			toHash(config.OPTypeGreeting),
			toHash(config.OPCommandSayHello),
			payload,
		)

		status, body := e.processAction(action)
		if status != http.StatusOK {
			t.Fatalf("call %d: expected status %d, got %d", i, http.StatusOK, status)
		}

		var result teetypes.ActionResult
		json.Unmarshal(body, &result)

		var resp types.SayHelloResponse
		json.Unmarshal(result.Data, &resp)

		if resp.GreetingNumber != i {
			t.Errorf("call %d: expected GreetingNumber=%d, got %d", i, i, resp.GreetingNumber)
		}
	}
}

func TestProcessAction_InvalidDataMessage(t *testing.T) {
	e := &Extension{}

	// Data.Message is not valid JSON — processorutils.Parse should fail
	action := teetypes.Action{
		Data: teetypes.ActionData{
			ID:      common.HexToHash("0xabcd"),
			Message: []byte(`not json at all`),
		},
	}

	status, body := e.processAction(action)

	if status != http.StatusBadRequest {
		t.Fatalf("expected status %d for invalid Data.Message, got %d: %s",
			http.StatusBadRequest, status, body)
	}

	bodyStr := string(body)
	if !contains(bodyStr, "decoding fixed data") {
		t.Errorf("expected body to mention 'decoding fixed data', got %q", bodyStr)
	}
	t.Logf("400 body: %s", bodyStr)
}

func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
