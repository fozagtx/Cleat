// Package types contains types that could be useful to other apps when interacting with this extension.
package types

import "github.com/ethereum/go-ethereum/common"

// Cleat request/response types live in internal/machine.
// GET /state must keep the greeting fields byte-identical for conformance fixture 16.

// State holds the extension's observable state, returned by GET /state.
type State struct {
	Rehydrated bool `json:"rehydrated"`
}

// --- DO NOT MODIFY below this line. ---

// StateResponse is the envelope returned by GET /state.
type StateResponse struct {
	StateVersion common.Hash `json:"stateVersion"`
	State        State       `json:"state"`
}
