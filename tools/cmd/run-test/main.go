package main

import (
	"flag"
	"strings"
	"time"

	"extension-scaffold/tools/pkg/configs"
	"extension-scaffold/tools/pkg/fccutils"
	"extension-scaffold/tools/pkg/support"
	instrutils "extension-scaffold/tools/pkg/utils"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/pkg/errors"
)

func main() {
	af := flag.String("a", configs.AddressesFile, "file with deployed addresses")
	cf := flag.String("c", configs.ChainNodeURL, "chain node url")
	pf := flag.String("p", configs.ExtensionProxyURL, "extension proxy url")
	instructionSenderF := flag.String("instructionSender", "", "instructionSender address")
	flag.Parse()

	instructionSenderAddress := common.HexToAddress(*instructionSenderF)

	testSupport, err := support.DefaultSupport(*af, *cf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}

	// --- Generic: configure contract -----------------------------------------
	logger.Infof("Setting extension ID on instruction sender...")
	err = instrutils.SetExtensionId(testSupport, instructionSenderAddress)
	if err != nil {
		if strings.Contains(err.Error(), "already set") || strings.Contains(err.Error(), "Extension ID already set") {
			logger.Infof("Extension ID already set on contract, continuing")
		} else {
			logger.Errorf("setExtensionId failed: %s", err)
			fccutils.FatalWithCause(errors.Errorf(
				"setExtensionId failed — is the extension registered? Check that pre-build.sh completed successfully. Error: %s", err))
		}
	}

	// The smoke test uses a non-zero commitment and verifies Cleat's ABI result.
	commitment := common.HexToHash("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	logger.Infof("Sending CHECK instruction...")
	instructionId, _, err := instrutils.SendCheck(testSupport, instructionSenderAddress, commitment)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Instruction sent. ID: %s", instructionId.Hex())

	time.Sleep(5 * time.Second)

	err = verifyCleatResult(*pf, instructionId, commitment)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Test passed: CHECK instruction processed successfully")

	logger.Infof("All tests passed.")
}

func verifyCleatResult(proxyURL string, instructionId, expectedCommitment common.Hash) error {
	// --- Generic: poll proxy for result (do not modify) ---
	actionResponse, err := fccutils.ActionResult(proxyURL, instructionId)
	if err != nil {
		return err
	}
	actionResult := actionResponse.Result

	if actionResult.Status == 0 {
		return errors.Errorf("instruction processing failed: %s", actionResult.Log)
	}
	if actionResult.Status == 2 {
		return errors.New("instruction still pending after polling, expected completed")
	}

	if len(actionResult.Data) == 0 {
		return errors.New("expected response data but got none")
	}

	bytes32Type, err := abi.NewType("bytes32", "", nil)
	if err != nil {
		return err
	}
	uint8Type, err := abi.NewType("uint8", "", nil)
	if err != nil {
		return err
	}
	values, err := (abi.Arguments{{Type: bytes32Type}, {Type: bytes32Type}, {Type: uint8Type}}).Unpack(actionResult.Data)
	if err != nil {
		return errors.Errorf("failed to decode Cleat result: %s", err)
	}
	if len(values) != 3 {
		return errors.Errorf("expected 3 result values, got %d", len(values))
	}
	requestID := common.Hash(values[0].([32]byte))
	commitment := common.Hash(values[1].([32]byte))
	verdict := values[2].(uint8)
	if requestID != instructionId {
		return errors.Errorf("request ID mismatch: expected %s, got %s", instructionId, requestID)
	}
	if commitment != expectedCommitment {
		return errors.Errorf("commitment mismatch: expected %s, got %s", expectedCommitment, commitment)
	}
	if verdict > 2 {
		return errors.Errorf("invalid CHECK verdict: %d", verdict)
	}
	logger.Infof("Response verdict: %d", verdict)
	return nil
}
