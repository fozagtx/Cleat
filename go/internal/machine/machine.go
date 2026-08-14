// Package machine is the Cleat dual state machine.
//
// Two machines, one commitment:
//
//	Pledge     UNPLEDGED | ACTIVE | RELEASED | DEFAULT
//	Financing  ACTIVE | REPAID | DEFAULTED | CANCELLED
//
// Pledge REPAID from PRD §6 is not a pledge state. It is FinancingStatusREPAID.
// Pledge PLEDGED from PRD §6 is PledgeStatusACTIVE.
package machine

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// Pledge statuses — PRD §30 vocabulary. ACTIVE is the live lien.
const (
	PledgeUnpledged = "UNPLEDGED"
	PledgeActive    = "ACTIVE"
	PledgeReleased  = "RELEASED"
	PledgeDefault   = "DEFAULT"
)

// Financing statuses — PRD §10. Distinct from pledge. CANCELLED is not DEFAULT.
const (
	FinancingNone      = ""
	FinancingActive    = "ACTIVE"
	FinancingRepaid    = "REPAID"
	FinancingDefaulted = "DEFAULTED"
	FinancingCancelled = "CANCELLED"
)

// CHECK reasons — architect axis, not the PRD's NOT_PLEDGED alias.
const (
	CheckClear          = "CLEAR"           // eligible; PRD §12 NOT_PLEDGED
	CheckAlreadyPledged = "ALREADY_PLEDGED" // live lien
	CheckInvalid        = "INVALID"         // malformed, expired, defaulted, replay
)

// RELEASE outcomes. FCC has no DEFAULT command; DEFAULT is an outcome of RELEASE.
const (
	OutcomeRepaid    = "REPAID"    // ACTIVE → RELEASED, financing → REPAID
	OutcomeDefault   = "DEFAULT"   // ACTIVE → DEFAULT, financing → DEFAULTED
	OutcomeCancelled = "CANCELLED" // ACTIVE → RELEASED, financing → CANCELLED
)

// Details qualify INVALID / rejection without collapsing the three CHECK results.
const (
	DetailMalformedCommitment = "MALFORMED_COMMITMENT"
	DetailMalformedAddress    = "MALFORMED_ADDRESS"
	DetailExpired             = "EXPIRED"
	DetailReplay              = "DUPLICATE_REQUEST_ID"
	DetailDefaulted           = "DEFAULTED"
	DetailAlreadyPledged      = "ALREADY_PLEDGED"
	DetailUnauthorized        = "UNAUTHORIZED"
	DetailBadState            = "ILLEGAL_TRANSITION"
	DetailMissingFinancier    = "MISSING_FINANCIER"
	DetailCallerMismatch      = "CALLER_NOT_FINANCIER"
	DetailUnknownOutcome      = "UNKNOWN_OUTCOME"
	DetailNoPledge            = "NO_ACTIVE_PLEDGE"
	DetailStateUnavailable    = "STATE_NOT_REHYDRATED"
	DetailUnsealed            = "COMMITMENT_NOT_SEALED"
	DetailCommitmentMismatch  = "COMMITMENT_MISMATCH"
)

// Roles are demo labels. Authorization is address-based, not self-declared role.
const (
	RoleLender   = "LENDER"
	RoleBorrower = "BORROWER"
	RoleProtocol = "PROTOCOL"
)

// PledgeRecord is the confidential current lien on one commitment.
type PledgeRecord struct {
	Commitment    string
	Status        string
	Financier     string
	FinancingID   string
	UpdatedAt     int64
	LastFinancier string
}

// FinancingRecord is one loan against a commitment. History is append-only.
type FinancingRecord struct {
	ID         string
	Commitment string
	Lender     string
	Amount     string
	CreatedAt  int64
	Status     string
}

// CheckRequest is the CHECK payload.
type CheckRequest struct {
	InvoiceCommitment string `json:"invoiceCommitment"`
	RequestID         string `json:"requestId,omitempty"`
	ValidUntil        int64  `json:"validUntil,omitempty"`
	Caller            string `json:"caller,omitempty"`
	Role              string `json:"role,omitempty"`
}

// CheckResult is the only thing a lender is allowed to learn.
type CheckResult struct {
	Eligible bool   `json:"eligible"`
	Reason   string `json:"reason"`
	Detail   string `json:"detail,omitempty"`
	Status   string `json:"status,omitempty"`
}

// PledgeRequest is the PLEDGE payload.
type PledgeRequest struct {
	InvoiceCommitment string `json:"invoiceCommitment"`
	Financier         string `json:"financier"`
	Caller            string `json:"caller"`
	Amount            string `json:"amount,omitempty"`
	RequestID         string `json:"requestId,omitempty"`
	ValidUntil        int64  `json:"validUntil,omitempty"`
	Role              string `json:"role,omitempty"`
}

// PledgeResult is returned after PLEDGE.
type PledgeResult struct {
	OK          bool   `json:"ok"`
	Reason      string `json:"reason,omitempty"`
	Detail      string `json:"detail,omitempty"`
	Status      string `json:"status,omitempty"`
	FinancingID string `json:"financingId,omitempty"`
	Financing   string `json:"financingStatus,omitempty"`
}

// ReleaseRequest is RELEASE. Outcome selects REPAID / DEFAULT / CANCELLED.
type ReleaseRequest struct {
	InvoiceCommitment string `json:"invoiceCommitment"`
	Caller            string `json:"caller"`
	Outcome           string `json:"outcome"`
	RequestID         string `json:"requestId,omitempty"`
	Role              string `json:"role,omitempty"`
}

// ReleaseResult is returned after RELEASE.
type ReleaseResult struct {
	OK        bool   `json:"ok"`
	Reason    string `json:"reason,omitempty"`
	Detail    string `json:"detail,omitempty"`
	Status    string `json:"status,omitempty"`
	Financing string `json:"financingStatus,omitempty"`
}

// StatusRequest is STATUS.
type StatusRequest struct {
	InvoiceCommitment string `json:"invoiceCommitment"`
	Caller            string `json:"caller,omitempty"`
	Role              string `json:"role,omitempty"`
}

// StatusResult is public pledge + financing status. No invoice fields.
type StatusResult struct {
	OK              bool   `json:"ok"`
	Reason          string `json:"reason,omitempty"`
	Detail          string `json:"detail,omitempty"`
	PledgeStatus    string `json:"pledgeStatus"`
	Financier       string `json:"financier,omitempty"`
	FinancingID     string `json:"financingId,omitempty"`
	FinancingStatus string `json:"financingStatus,omitempty"`
}

// SealRequest is delivered only through the encrypted direct channel.
type SealRequest struct {
	InvoiceNumber string `json:"invoiceNumber"`
	DebtorName    string `json:"debtorName"`
	Currency      string `json:"currency"`
	AmountMinor   string `json:"amountMinor"`
	DueDate       uint64 `json:"dueDate"`
	Nonce         string `json:"nonce"`
	Commitment    string `json:"commitment"`
}

// SealResult confirms that a confidential invoice preimage was validated.
type SealResult struct {
	OK         bool   `json:"ok"`
	Reason     string `json:"reason,omitempty"`
	Detail     string `json:"detail,omitempty"`
	Commitment string `json:"commitment,omitempty"`
}

// Store is the confidential dual machine. Chain mirrors status, not invoices.
type Store struct {
	mu sync.Mutex

	Now      func() int64
	Protocol string // extra RELEASE/DEFAULT actor; empty = financier only

	pledges    map[string]*PledgeRecord
	financings map[string]*FinancingRecord
	byCommit   map[string][]string
	requestIDs map[string]struct{}
	invoiceIDs map[string]string
	seq        uint64
	rehydrated bool
}

func NewStore() *Store {
	return &Store{
		Now:        func() int64 { return time.Now().Unix() },
		pledges:    make(map[string]*PledgeRecord),
		financings: make(map[string]*FinancingRecord),
		byCommit:   make(map[string][]string),
		requestIDs: make(map[string]struct{}),
		invoiceIDs: make(map[string]string),
	}
}

// Seal validates an encrypted invoice preimage and binds its private invoice ID
// to the public commitment. The plaintext must never leave the TEE.
func (s *Store) Seal(req SealRequest) SealResult {
	invoiceNumber := strings.TrimSpace(req.InvoiceNumber)
	debtorName := strings.TrimSpace(req.DebtorName)
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	amount, ok := new(big.Int).SetString(strings.TrimSpace(req.AmountMinor), 10)
	if invoiceNumber == "" || debtorName == "" || len(currency) != 3 || !ok || amount.Sign() <= 0 || req.DueDate == 0 {
		return SealResult{Reason: CheckInvalid, Detail: DetailMalformedCommitment}
	}
	nonce, err := normalizeCommitment(req.Nonce)
	if err != nil {
		return SealResult{Reason: CheckInvalid, Detail: DetailMalformedCommitment}
	}
	commitment, err := normalizeCommitment(req.Commitment)
	if err != nil {
		return SealResult{Reason: CheckInvalid, Detail: DetailMalformedCommitment}
	}

	var domain [32]byte
	copy(domain[:], []byte("CLEAT_INVOICE_V1"))
	invoicePayload, err := (abi.Arguments{
		{Type: mustABIType("bytes32")},
		{Type: mustABIType("string")},
		{Type: mustABIType("string")},
		{Type: mustABIType("string")},
		{Type: mustABIType("uint256")},
		{Type: mustABIType("uint64")},
	}).Pack(domain, invoiceNumber, debtorName, currency, amount, req.DueDate)
	if err != nil {
		return SealResult{Reason: CheckInvalid, Detail: DetailMalformedCommitment}
	}
	invoiceID := crypto.Keccak256Hash(invoicePayload)
	commitmentPayload, err := (abi.Arguments{
		{Type: mustABIType("bytes32")},
		{Type: mustABIType("bytes32")},
	}).Pack([32]byte(invoiceID), [32]byte(common.HexToHash(nonce)))
	if err != nil {
		return SealResult{Reason: CheckInvalid, Detail: DetailMalformedCommitment}
	}
	if !strings.EqualFold(crypto.Keccak256Hash(commitmentPayload).Hex(), commitment) {
		return SealResult{Reason: CheckInvalid, Detail: DetailCommitmentMismatch}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, exists := s.invoiceIDs[commitment]; exists && existing != invoiceID.Hex() {
		return SealResult{Reason: CheckInvalid, Detail: DetailCommitmentMismatch}
	}
	s.invoiceIDs[commitment] = invoiceID.Hex()
	return SealResult{OK: true, Commitment: commitment}
}

func mustABIType(kind string) abi.Type {
	value, err := abi.NewType(kind, "", nil)
	if err != nil {
		panic(err)
	}
	return value
}

// CompleteRehydration marks an empty chain snapshot as authoritative.
// Callers must only invoke this after all on-chain pledge state has been loaded.
func (s *Store) CompleteRehydration() {
	s.mu.Lock()
	s.rehydrated = true
	s.mu.Unlock()
}

// IsRehydrated reports whether the store has loaded an authoritative chain snapshot.
func (s *Store) IsRehydrated() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rehydrated
}

// LoadPledge applies one authoritative PledgeRegistry state during startup.
// It must be called before CompleteRehydration.
func (s *Store) LoadPledge(record PledgeRecord) error {
	commitment, err := normalizeCommitment(record.Commitment)
	if err != nil {
		return fmt.Errorf("invalid rehydration commitment: %w", err)
	}

	switch record.Status {
	case PledgeActive, PledgeDefault:
		financier, err := normalizeAddress(record.Financier)
		if err != nil {
			return fmt.Errorf("invalid rehydration financier: %w", err)
		}
		record.Financier = financier
		record.LastFinancier = financier
	case PledgeReleased:
		record.Financier = ""
	default:
		return fmt.Errorf("invalid rehydration status %q", record.Status)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.rehydrated {
		return fmt.Errorf("rehydration already completed")
	}
	record.Commitment = commitment
	s.pledges[commitment] = &record
	return nil
}

func (s *Store) getPledge(commitment string) (*PledgeRecord, bool) {
	if p, ok := s.pledges[commitment]; ok {
		return p, true
	}
	if !s.rehydrated {
		return nil, false
	}
	return &PledgeRecord{Commitment: commitment, Status: PledgeUnpledged}, true
}

func (s *Store) invoiceConflict(commitment string) (*PledgeRecord, bool) {
	invoiceID, sealed := s.invoiceIDs[commitment]
	if !sealed {
		return nil, false
	}
	for otherCommitment, otherInvoiceID := range s.invoiceIDs {
		if otherCommitment == commitment || otherInvoiceID != invoiceID {
			continue
		}
		pledge, authoritative := s.getPledge(otherCommitment)
		if !authoritative {
			return nil, true
		}
		if pledge.Status == PledgeActive || pledge.Status == PledgeDefault {
			return pledge, true
		}
	}
	return nil, true
}

// CHECK — any caller. Does not mutate pledge/financing. May consume requestId.
func (s *Store) Check(req CheckRequest) CheckResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	commitment, err := normalizeCommitment(req.InvoiceCommitment)
	if err != nil {
		return CheckResult{Eligible: false, Reason: CheckInvalid, Detail: DetailMalformedCommitment}
	}
	if detail := s.gateRequest(req.RequestID, req.ValidUntil, true); detail != "" {
		return CheckResult{Eligible: false, Reason: CheckInvalid, Detail: detail}
	}
	if conflict, sealed := s.invoiceConflict(commitment); !sealed {
		return CheckResult{Eligible: false, Reason: CheckInvalid, Detail: DetailUnsealed}
	} else if conflict != nil {
		if conflict.Status == PledgeDefault {
			return CheckResult{Eligible: false, Reason: CheckInvalid, Detail: DetailDefaulted, Status: conflict.Status}
		}
		return CheckResult{Eligible: false, Reason: CheckAlreadyPledged, Status: conflict.Status}
	}

	p, authoritative := s.getPledge(commitment)
	if !authoritative {
		return CheckResult{Eligible: false, Reason: CheckInvalid, Detail: DetailStateUnavailable}
	}
	switch p.Status {
	case PledgeUnpledged, PledgeReleased:
		return CheckResult{Eligible: true, Reason: CheckClear, Status: p.Status}
	case PledgeActive:
		return CheckResult{Eligible: false, Reason: CheckAlreadyPledged, Status: p.Status}
	case PledgeDefault:
		// Defaulted invoices are not "already pledged" and not financeable.
		return CheckResult{Eligible: false, Reason: CheckInvalid, Detail: DetailDefaulted, Status: p.Status}
	default:
		return CheckResult{Eligible: false, Reason: CheckInvalid, Detail: DetailBadState, Status: p.Status}
	}
}

// PLEDGE — lender only. Caller must equal financier.
// UNPLEDGED → ACTIVE; RELEASED → ACTIVE (new financing). ACTIVE/DEFAULT forbidden.
func (s *Store) Pledge(req PledgeRequest) PledgeResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	commitment, err := normalizeCommitment(req.InvoiceCommitment)
	if err != nil {
		return PledgeResult{Reason: CheckInvalid, Detail: DetailMalformedCommitment}
	}
	financier, err := normalizeAddress(req.Financier)
	if err != nil {
		return PledgeResult{Reason: CheckInvalid, Detail: DetailMissingFinancier}
	}
	caller, err := normalizeAddress(req.Caller)
	if err != nil {
		return PledgeResult{Reason: CheckInvalid, Detail: DetailMalformedAddress}
	}
	if caller != financier {
		return PledgeResult{Reason: CheckInvalid, Detail: DetailCallerMismatch}
	}
	if req.Role == RoleBorrower {
		return PledgeResult{Reason: CheckInvalid, Detail: DetailUnauthorized}
	}
	if detail := s.gateRequest(req.RequestID, req.ValidUntil, true); detail != "" {
		return PledgeResult{Reason: CheckInvalid, Detail: detail}
	}
	if conflict, sealed := s.invoiceConflict(commitment); !sealed {
		return PledgeResult{Reason: CheckInvalid, Detail: DetailUnsealed}
	} else if conflict != nil {
		if conflict.Status == PledgeDefault {
			return PledgeResult{Reason: CheckInvalid, Detail: DetailDefaulted, Status: conflict.Status}
		}
		return PledgeResult{Reason: CheckAlreadyPledged, Detail: DetailAlreadyPledged, Status: conflict.Status}
	}

	p, authoritative := s.getPledge(commitment)
	if !authoritative {
		return PledgeResult{Reason: CheckInvalid, Detail: DetailStateUnavailable}
	}
	switch p.Status {
	case PledgeActive:
		return PledgeResult{Reason: CheckAlreadyPledged, Detail: DetailAlreadyPledged, Status: p.Status}
	case PledgeDefault:
		return PledgeResult{Reason: CheckInvalid, Detail: DetailDefaulted, Status: p.Status}
	case PledgeUnpledged, PledgeReleased:
		// allowed
	default:
		return PledgeResult{Reason: CheckInvalid, Detail: DetailBadState, Status: p.Status}
	}

	s.seq++
	now := s.Now()
	fid := financingID(commitment, financier, s.seq)
	fin := &FinancingRecord{
		ID:         fid,
		Commitment: commitment,
		Lender:     financier,
		Amount:     req.Amount,
		CreatedAt:  now,
		Status:     FinancingActive,
	}
	s.financings[fid] = fin
	s.byCommit[commitment] = append(s.byCommit[commitment], fid)

	next := &PledgeRecord{
		Commitment:    commitment,
		Status:        PledgeActive,
		Financier:     financier,
		FinancingID:   fid,
		UpdatedAt:     now,
		LastFinancier: financier,
	}
	s.pledges[commitment] = next
	return PledgeResult{
		OK:          true,
		Status:      PledgeActive,
		FinancingID: fid,
		Financing:   FinancingActive,
	}
}

// RELEASE — current financier, or Protocol.
// Borrower and random wallets cannot release or default.
func (s *Store) Release(req ReleaseRequest) ReleaseResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	commitment, err := normalizeCommitment(req.InvoiceCommitment)
	if err != nil {
		return ReleaseResult{Reason: CheckInvalid, Detail: DetailMalformedCommitment}
	}
	caller, err := normalizeAddress(req.Caller)
	if err != nil {
		return ReleaseResult{Reason: CheckInvalid, Detail: DetailMalformedAddress}
	}
	if detail := s.gateRequest(req.RequestID, 0, true); detail != "" {
		return ReleaseResult{Reason: CheckInvalid, Detail: detail}
	}

	outcome := strings.ToUpper(strings.TrimSpace(req.Outcome))
	if outcome == "" {
		outcome = OutcomeRepaid
	}

	p, authoritative := s.getPledge(commitment)
	if !authoritative {
		return ReleaseResult{Reason: CheckInvalid, Detail: DetailStateUnavailable}
	}
	if p.Status != PledgeActive {
		return ReleaseResult{Reason: CheckInvalid, Detail: DetailNoPledge, Status: p.Status}
	}

	if !s.mayMutate(caller, p.Financier, req.Role, outcome) {
		return ReleaseResult{Reason: CheckInvalid, Detail: DetailUnauthorized, Status: p.Status}
	}

	fin := s.financings[p.FinancingID]
	now := s.Now()

	switch outcome {
	case OutcomeRepaid:
		p.Status = PledgeReleased
		p.Financier = ""
		p.UpdatedAt = now
		if fin != nil {
			fin.Status = FinancingRepaid
		}
		s.pledges[commitment] = p
		return ReleaseResult{OK: true, Status: PledgeReleased, Financing: FinancingRepaid}

	case OutcomeDefault:
		p.Status = PledgeDefault
		p.UpdatedAt = now
		// Financier remains: DEFAULT is terminal; they are the injured lender.
		if fin != nil {
			fin.Status = FinancingDefaulted
		}
		s.pledges[commitment] = p
		return ReleaseResult{OK: true, Status: PledgeDefault, Financing: FinancingDefaulted}

	case OutcomeCancelled:
		p.Status = PledgeReleased
		p.Financier = ""
		p.UpdatedAt = now
		if fin != nil {
			fin.Status = FinancingCancelled
		}
		s.pledges[commitment] = p
		return ReleaseResult{OK: true, Status: PledgeReleased, Financing: FinancingCancelled}

	default:
		return ReleaseResult{Reason: CheckInvalid, Detail: DetailUnknownOutcome, Status: p.Status}
	}
}

// Status — any caller. No invoice / debtor / amount.
func (s *Store) Status(req StatusRequest) StatusResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	commitment, err := normalizeCommitment(req.InvoiceCommitment)
	if err != nil {
		return StatusResult{Reason: CheckInvalid, Detail: DetailMalformedCommitment}
	}
	p, authoritative := s.getPledge(commitment)
	if !authoritative {
		return StatusResult{Reason: CheckInvalid, Detail: DetailStateUnavailable}
	}
	finStatus := FinancingNone
	if p.FinancingID != "" {
		if fin := s.financings[p.FinancingID]; fin != nil {
			finStatus = fin.Status
		}
	}
	return StatusResult{
		OK:              true,
		PledgeStatus:    p.Status,
		Financier:       p.Financier,
		FinancingID:     p.FinancingID,
		FinancingStatus: finStatus,
	}
}

func (s *Store) Financing(id string) *FinancingRecord {
	s.mu.Lock()
	defer s.mu.Unlock()
	f := s.financings[id]
	if f == nil {
		return nil
	}
	cp := *f
	return &cp
}

func (s *Store) mayMutate(caller, financier, role, outcome string) bool {
	if role == RoleBorrower {
		return false
	}
	if caller == financier {
		return true
	}
	if s.Protocol != "" && caller == s.Protocol {
		return true
	}
	_ = outcome
	return false
}

func (s *Store) gateRequest(requestID string, validUntil int64, consume bool) string {
	if validUntil > 0 && s.Now() > validUntil {
		return DetailExpired
	}
	id := strings.TrimSpace(requestID)
	if id == "" {
		return ""
	}
	if _, seen := s.requestIDs[id]; seen {
		return DetailReplay
	}
	if consume {
		s.requestIDs[id] = struct{}{}
	}
	return ""
}

func financingID(commitment, financier string, seq uint64) string {
	h := crypto.Keccak256Hash(
		[]byte(commitment),
		[]byte(financier),
		[]byte(fmt.Sprintf("%d", seq)),
	)
	return h.Hex()
}

func normalizeCommitment(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "0x")
	s = strings.TrimPrefix(s, "0X")
	if len(s) != 64 {
		return "", fmt.Errorf("commitment must be 32 bytes")
	}
	b, err := hex.DecodeString(s)
	if err != nil || len(b) != 32 {
		return "", fmt.Errorf("commitment hex")
	}
	if common.BytesToHash(b) == (common.Hash{}) {
		return "", fmt.Errorf("zero commitment")
	}
	return "0x" + strings.ToLower(s), nil
}

func normalizeAddress(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if !common.IsHexAddress(s) {
		return "", fmt.Errorf("address")
	}
	addr := common.HexToAddress(s)
	if addr == (common.Address{}) {
		return "", fmt.Errorf("zero address")
	}
	return strings.ToLower(addr.Hex()), nil
}
