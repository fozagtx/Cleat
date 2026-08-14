package extension

import (
	"encoding/hex"
	"testing"

	"github.com/ethereum/go-ethereum/crypto"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"
)

func TestBrowserECIES_IsCompatibleWithTeeNode(t *testing.T) {
	privateKey, err := crypto.HexToECDSA("0000000000000000000000000000000000000000000000000000000000000001")
	if err != nil {
		t.Fatal(err)
	}
	ciphertext, err := hex.DecodeString(
		"04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5" +
			"1ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a" +
			"00000000000000000000000000000000" +
			"6da28ce490e9a56be8080f60" +
			"14dbb91f5704af40c7121b62e8b640233a5b3701998f9e008104ab000f50bed2",
	)
	if err != nil {
		t.Fatal(err)
	}
	plaintext, err := teeutils.Decrypt(ciphertext, privateKey)
	if err != nil {
		t.Fatalf("tee-node could not decrypt browser ciphertext: %v", err)
	}
	if string(plaintext) != "cleat-compat" {
		t.Fatalf("plaintext=%q", plaintext)
	}
}
