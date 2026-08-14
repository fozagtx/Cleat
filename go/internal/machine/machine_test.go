package machine

import (
	"testing"
)

const (
	inv     = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	invB    = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	alice   = "0x1111111111111111111111111111111111111111"
	bob     = "0x2222222222222222222222222222222222222222"
	mallory = "0x3333333333333333333333333333333333333333"
	proto   = "0x4444444444444444444444444444444444444444"
)

func storeAt(ts int64) *Store {
	s := NewStore()
	s.Now = func() int64 { return ts }
	s.Protocol = proto
	s.CompleteRehydration()
	return s
}

func TestCheck_UnrehydratedStoreFailsClosed(t *testing.T) {
	s := NewStore()
	got := s.Check(CheckRequest{InvoiceCommitment: inv, RequestID: "restart-check"})
	if got.Eligible || got.Reason != CheckInvalid || got.Detail != DetailStateUnavailable {
		t.Fatalf("empty restart must not mean UNPLEDGED: %+v", got)
	}
}

func TestCheck_UnpledgedIsClear(t *testing.T) {
	s := storeAt(1000)
	got := s.Check(CheckRequest{InvoiceCommitment: inv, Caller: bob, Role: RoleLender})
	if !got.Eligible || got.Reason != CheckClear || got.Status != PledgeUnpledged {
		t.Fatalf("CHECK unpledged: %+v", got)
	}
}

func TestCheck_ActiveIsAlreadyPledged(t *testing.T) {
	s := storeAt(1000)
	if r := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice, Amount: "70000"}); !r.OK {
		t.Fatalf("pledge: %+v", r)
	}
	got := s.Check(CheckRequest{InvoiceCommitment: inv, Caller: bob})
	if got.Eligible || got.Reason != CheckAlreadyPledged {
		t.Fatalf("CHECK active: %+v", got)
	}
}

func TestCheck_DefaultIsInvalidNotAlreadyPledged(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeDefault})
	got := s.Check(CheckRequest{InvoiceCommitment: inv, Caller: bob})
	if got.Eligible || got.Reason != CheckInvalid || got.Detail != DetailDefaulted {
		t.Fatalf("CHECK defaulted must be INVALID/DEFAULTED, got %+v", got)
	}
}

func TestCheck_ReleasedIsClear(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeRepaid})
	got := s.Check(CheckRequest{InvoiceCommitment: inv, Caller: bob})
	if !got.Eligible || got.Reason != CheckClear || got.Status != PledgeReleased {
		t.Fatalf("CHECK released: %+v", got)
	}
}

func TestCheck_MalformedIsInvalid(t *testing.T) {
	s := storeAt(1000)
	got := s.Check(CheckRequest{InvoiceCommitment: "not-a-hash"})
	if got.Eligible || got.Reason != CheckInvalid || got.Detail != DetailMalformedCommitment {
		t.Fatalf("CHECK malformed: %+v", got)
	}
}

func TestCheck_ExpiredIsInvalid(t *testing.T) {
	s := storeAt(2000)
	got := s.Check(CheckRequest{InvoiceCommitment: inv, ValidUntil: 1000})
	if got.Reason != CheckInvalid || got.Detail != DetailExpired {
		t.Fatalf("CHECK expired: %+v", got)
	}
}

func TestPledge_UnpledgedToActive(t *testing.T) {
	s := storeAt(1000)
	got := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice, Amount: "70000"})
	if !got.OK || got.Status != PledgeActive || got.Financing != FinancingActive {
		t.Fatalf("PLEDGE: %+v", got)
	}
	st := s.Status(StatusRequest{InvoiceCommitment: inv})
	if st.PledgeStatus != PledgeActive || st.Financier != alice {
		t.Fatalf("status: %+v", st)
	}
}

func TestPledge_ActiveForbidden(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	got := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: bob, Caller: bob})
	if got.OK || got.Reason != CheckAlreadyPledged {
		t.Fatalf("duplicate PLEDGE must fail: %+v", got)
	}
}

func TestPledge_ReleasedToActiveNewFinancing(t *testing.T) {
	s := storeAt(1000)
	first := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice, Amount: "70000"})
	s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeRepaid})
	second := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: bob, Caller: bob, Amount: "65000"})
	if !second.OK || second.Status != PledgeActive {
		t.Fatalf("re-pledge after RELEASED: %+v", second)
	}
	if second.FinancingID == first.FinancingID {
		t.Fatal("new financing must mint a new financingId")
	}
	old := s.Financing(first.FinancingID)
	if old == nil || old.Status != FinancingRepaid {
		t.Fatalf("old financing must stay REPAID: %+v", old)
	}
	neu := s.Financing(second.FinancingID)
	if neu == nil || neu.Status != FinancingActive || neu.Lender != bob {
		t.Fatalf("new financing: %+v", neu)
	}
}

func TestPledge_DefaultToActiveForbidden(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeDefault})
	got := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: bob, Caller: bob})
	if got.OK || got.Detail != DetailDefaulted {
		t.Fatalf("DEFAULT → ACTIVE must be forbidden: %+v", got)
	}
}

func TestPledge_CallerMustBeFinancier(t *testing.T) {
	s := storeAt(1000)
	got := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: bob})
	if got.OK || got.Detail != DetailCallerMismatch {
		t.Fatalf("caller≠financier: %+v", got)
	}
}

func TestPledge_MissingCallerRejected(t *testing.T) {
	s := storeAt(1000)
	got := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice})
	if got.OK || got.Detail != DetailMalformedAddress {
		t.Fatalf("missing caller must not inherit financier: %+v", got)
	}
}

func TestPledge_BorrowerForbidden(t *testing.T) {
	s := storeAt(1000)
	got := s.Pledge(PledgeRequest{
		InvoiceCommitment: inv, Financier: alice, Caller: alice, Role: RoleBorrower,
	})
	if got.OK || got.Detail != DetailUnauthorized {
		t.Fatalf("borrower PLEDGE: %+v", got)
	}
}

func TestRelease_Repaid(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	got := s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeRepaid})
	if !got.OK || got.Status != PledgeReleased || got.Financing != FinancingRepaid {
		t.Fatalf("RELEASE REPAID: %+v", got)
	}
}

func TestRelease_Default(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	got := s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeDefault})
	if !got.OK || got.Status != PledgeDefault || got.Financing != FinancingDefaulted {
		t.Fatalf("RELEASE DEFAULT: %+v", got)
	}
	st := s.Status(StatusRequest{InvoiceCommitment: inv})
	if st.Financier != alice {
		t.Fatalf("default must keep injured financier: %+v", st)
	}
}

func TestRelease_CancelledIsNotDefault(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	got := s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeCancelled})
	if !got.OK || got.Status != PledgeReleased || got.Financing != FinancingCancelled {
		t.Fatalf("CANCELLED: %+v", got)
	}
	check := s.Check(CheckRequest{InvoiceCommitment: inv})
	if !check.Eligible || check.Reason != CheckClear {
		t.Fatalf("cancelled invoice must be CLEAR, not INVALID: %+v", check)
	}
}

func TestRelease_UnauthorizedWallet(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	got := s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: mallory, Outcome: OutcomeRepaid})
	if got.OK || got.Detail != DetailUnauthorized {
		t.Fatalf("random wallet RELEASE: %+v", got)
	}
}

func TestRelease_BorrowerCannotDefault(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	got := s.Release(ReleaseRequest{
		InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeDefault, Role: RoleBorrower,
	})
	if got.OK || got.Detail != DetailUnauthorized {
		t.Fatalf("borrower DEFAULT: %+v", got)
	}
}

func TestRelease_ProtocolMayRepay(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	got := s.Release(ReleaseRequest{
		InvoiceCommitment: inv, Caller: proto, Outcome: OutcomeRepaid, Role: RoleProtocol,
	})
	if !got.OK || got.Status != PledgeReleased {
		t.Fatalf("protocol RELEASE: %+v", got)
	}
}

func TestRelease_EmptyOutcomeDefaultsToRepaid(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	got := s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice})
	if !got.OK || got.Status != PledgeReleased || got.Financing != FinancingRepaid {
		t.Fatalf("empty outcome: %+v", got)
	}
}

func TestRelease_UnpledgedForbidden(t *testing.T) {
	s := storeAt(1000)
	got := s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeRepaid})
	if got.OK || got.Detail != DetailNoPledge {
		t.Fatalf("RELEASE unpledged: %+v", got)
	}
}

func TestDuplicateRequestIdRejected(t *testing.T) {
	s := storeAt(1000)
	req := PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice, RequestID: "req-1"}
	if r := s.Pledge(req); !r.OK {
		t.Fatalf("first: %+v", r)
	}
	got := s.Pledge(PledgeRequest{InvoiceCommitment: invB, Financier: bob, Caller: bob, RequestID: "req-1"})
	if got.OK || got.Detail != DetailReplay {
		t.Fatalf("replay requestId: %+v", got)
	}
}

func TestCheck_DuplicateRequestIdRejected(t *testing.T) {
	s := storeAt(1000)
	req := CheckRequest{InvoiceCommitment: inv, RequestID: "check-1"}
	if first := s.Check(req); !first.Eligible {
		t.Fatalf("first CHECK: %+v", first)
	}
	got := s.Check(req)
	if got.Eligible || got.Detail != DetailReplay {
		t.Fatalf("replayed CHECK requestId: %+v", got)
	}
}

func TestIsolation_TwoCommitmentsIndependent(t *testing.T) {
	s := storeAt(1000)
	s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
	got := s.Check(CheckRequest{InvoiceCommitment: invB})
	if !got.Eligible || got.Reason != CheckClear {
		t.Fatalf("other invoice must stay CLEAR: %+v", got)
	}
}

func TestTransitionTable(t *testing.T) {
	type step struct {
		name    string
		run     func(*Store) (ok bool, detail, pledge, financing string)
		wantOK  bool
		detail  string
		pledge  string
		finance string
	}
	steps := []step{
		{
			name: "UNPLEDGED→ACTIVE via PLEDGE",
			run: func(s *Store) (bool, string, string, string) {
				r := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
				return r.OK, r.Detail, r.Status, r.Financing
			},
			wantOK: true, pledge: PledgeActive, finance: FinancingActive,
		},
		{
			name: "ACTIVE→ACTIVE via PLEDGE forbidden",
			run: func(s *Store) (bool, string, string, string) {
				r := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: bob, Caller: bob})
				st := s.Status(StatusRequest{InvoiceCommitment: inv})
				return r.OK, r.Detail, st.PledgeStatus, st.FinancingStatus
			},
			wantOK: false, detail: DetailAlreadyPledged, pledge: PledgeActive, finance: FinancingActive,
		},
		{
			name: "ACTIVE→RELEASED via REPAID",
			run: func(s *Store) (bool, string, string, string) {
				r := s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: alice, Outcome: OutcomeRepaid})
				return r.OK, r.Detail, r.Status, r.Financing
			},
			wantOK: true, pledge: PledgeReleased, finance: FinancingRepaid,
		},
		{
			name: "RELEASED→ACTIVE via new PLEDGE",
			run: func(s *Store) (bool, string, string, string) {
				r := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: bob, Caller: bob})
				return r.OK, r.Detail, r.Status, r.Financing
			},
			wantOK: true, pledge: PledgeActive, finance: FinancingActive,
		},
		{
			name: "ACTIVE→DEFAULT",
			run: func(s *Store) (bool, string, string, string) {
				r := s.Release(ReleaseRequest{InvoiceCommitment: inv, Caller: bob, Outcome: OutcomeDefault})
				return r.OK, r.Detail, r.Status, r.Financing
			},
			wantOK: true, pledge: PledgeDefault, finance: FinancingDefaulted,
		},
		{
			name: "DEFAULT→ACTIVE forbidden",
			run: func(s *Store) (bool, string, string, string) {
				r := s.Pledge(PledgeRequest{InvoiceCommitment: inv, Financier: alice, Caller: alice})
				st := s.Status(StatusRequest{InvoiceCommitment: inv})
				return r.OK, r.Detail, st.PledgeStatus, st.FinancingStatus
			},
			wantOK: false, detail: DetailDefaulted, pledge: PledgeDefault, finance: FinancingDefaulted,
		},
	}

	s := storeAt(1000)
	for _, step := range steps {
		ok, detail, pledge, finance := step.run(s)
		if ok != step.wantOK || detail != step.detail || pledge != step.pledge || finance != step.finance {
			t.Fatalf("%s: ok=%v detail=%q pledge=%q fin=%q (want ok=%v detail=%q pledge=%q fin=%q)",
				step.name, ok, detail, pledge, finance, step.wantOK, step.detail, step.pledge, step.finance)
		}
	}
}
