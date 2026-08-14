# Cleat — architecture lock

Council of 20. Time is not a reason to cut. Mock invoice data is allowed. Fake protocol verdicts are not.

**Track:** Flare Summer Signal — Confidential Compute Apps  
**Product:** The lender gets `eligible = true|false`. Not the receivables book.  
**Network:** Coston2 (114). Enclave is **Phala Cloud** (Intel TDX CVM). Not GCP Confidential Space. Laptop Docker is local iteration only.

---

## What the protocol proves

Cleat proves: this commitment is not already ACTIVE **inside this registry**, without revealing the preimage or the rest of the book.

It does **not** prove the invoice is real, legally owned, unique in the world, or paid in fiat.

FCC = private uniqueness. FDC = public settlement event. FTSO = conversion quote. Three primitives. One job each.

---

## Spine

Keep the official `fce-extension-scaffold` at repo root. Do not nest under `fce-extension/`. Do not delete official scripts.

```
go/ python/ typescript/     TEE languages (LANGUAGE=)
contracts/                  InstructionSender + product registries
scripts/ tools/             official FCC lifecycle
web/                        Next.js  (no language.env)
backend/                   Fastify   (no language.env)
```

`LANGUAGE=go`. One Cleat TEE image. Do not port CHECK/PLEDGE into Python/TS. Do not set `LANGUAGE=typescript` because the frontend is TypeScript.

---

## Contracts (four files)

| File | Job |
|---|---|
| `InstructionSender.sol` | FCC outbound only. Frozen ctor / `setExtensionId` / `_getExtensionId`. Adds `sendCheck` / `sendPledge` / `sendRelease`. |
| `VerificationGateway.sol` | Consumes attested TEE results. Only writer to PledgeRegistry. |
| `PledgeRegistry.sol` | Public `commitment → {financier, status, timestamp}`. No invoices. |
| `FinancingRegistry.sol` | Facility overlay. New row per pledge episode. |

Arbitrary wallets MUST NOT `registerPledge` / `releasePledge`. Financier is `msg.sender` of `sendPledge`, copied forward. Never a client-supplied `financier` field.

---

## Commands

`OP_TYPE = CLEAT`

`CHECK` `PLEDGE` `RELEASE` `STATUS`

Plus protocol `DEFAULT` (not a borrower product button). Strings identical in Solidity `bytes32`, Go config, and router. No `F_` prefix.

CHECK is read-only. PLEDGE is check-then-set. RELEASE frees the lien. DEFAULT burns it.

---

## State (two machines)

**Pledge** (what CHECK reads): `UNPLEDGED | ACTIVE | RELEASED | DEFAULT`

**Financing** (history): `ACTIVE | REPAID | DEFAULTED | CANCELLED`

- `ACTIVE → ACTIVE` forbidden (duplicate pledge)
- `RELEASED → ACTIVE` allowed as a **new** financing row
- `DEFAULT → ACTIVE` forbidden in v1
- `DEFAULT` is `eligible=false`, reason `DEFAULTED`, not `NOT_PLEDGED`

Authoritative public status and commitment live on **PledgeRegistry**. TEE RAM holds the private preimage while alive. After TEE restart: rehydrate from chain + client re-supply. Empty TEE MUST NOT mean UNPLEDGED.

---

## Commitment

Two hashes:

- `invoiceId` = unsalted identity of the fields. TEE uniqueness / nullifier. **Never on-chain.**
- `commitment` = `H(invoiceId, secretNonce)`. Public handle. **On-chain.**

Salt in v1, including the demo. `abi.encode` + domain separator. Amount as `uint256` minor units. Due date as `uint64` unix UTC. Client computes `C`. TEE recomputes. Mismatch = `INVALID`.

Competing lenders CHECK by sending encrypted fields to the TEE. They do not get the nonce. They do not call `getPledge` (that would join `financier` to the invoice).

---

## Encryption / channels

Invoice bytes never ride `sendInstructions.message`. Ciphertext never sits on-chain.

```
Browser seals (X25519/ECIES + AES-256-GCM to TEE pubkey from /info)
  → POST /direct (secret delivery)
  → on-chain instruction carries commitment + requestId only
  → TEE CHECK/PLEDGE
```

Backend is a courier of opaque bytes. It does not decrypt.

---

## Replay

`requestId` is on-chain, consume-once, in VerificationGateway.  
`requestId = instructionId` from `sendInstructions` in that same tx.  
`validUntil = block.timestamp + 10 minutes`, checked at consume.  
TEE RAM is not the used-set (relaunch mints a new `teeId`; map dies).

CHECK ticket binds to `commitment`. PLEDGE is a new instruction that re-checks the map.

---

## Backend + DB (not skipped)

Fastify + Prisma + PostgreSQL. Eight tables as specified. Application store, not trust.

Eligibility is never answered from Prisma. Seed INV-001 into `invoices`. Do **not** seed `eligible` or on-chain ACTIVE.

Borrower GET returns the book. Lender GET returns commitment + protocol result + NOT DISCLOSED. Server-enforced.

Postgres + Fastify attach via a **product compose overlay**. Official `docker-compose.yaml` stays redis + ext-proxy + extension-tee.

---

## Frontend

Next.js App Router, TypeScript, Tailwind, shadcn, wagmi, viem, `injected()` MetaMask. Coston2 114.

Exactly four routes: `/` `/borrower` `/lender` `/activity`.

Two-panel on `/lender`: borrower plane vs attested result. **Powered by Flare Confidential Compute** under it.

Attack panel = live CHECK/PLEDGE, not `setTimeout` → BLOCKED.

Activity: time, event, result, commitment, explorer. No INV-001 / ACME / $100k on `/lender` result, `/activity`, or calldata.

---

## FDC (designed now)

Settlement module `PaymentAttestation`. Not an invoice oracle. Not Web2Json-against-our-API.

- Demo: `EVMTransaction` / `testFLR`, reference = commitment
- RELEASE requires verified payment proof bound to commitment + receiver + min amount
- DEFAULT: UTXO/XRPL may use `ReferencedPaymentNonexistence`; EVM default is lender-declared after dueDate and labeled as assertion
- ACH/fiat has no FDC type. Say that.

---

## FTSO (hook now, not the hero)

`ICleatOracle.quoteUsd`. CHECK/PLEDGE do not call it.

USD = identity. BTC/XRP/FLR = listed `*/USD` feeds. EUR/GBP = UNSUPPORTED until listed.

Resolve FtsoV2 through Contract Registry `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`. Never hardcode FtsoV2. Stale feed aborts conversion, never flips `eligible`.

---

## FAssets / Smart Accounts

Not in the demo. Not on CHECK/PLEDGE/RELEASE payloads. Bind `msg.sender`, never `tx.origin`, so a future contract wallet still works. V4 may disburse in FXRP. That is a sentence in the README, not a module in v1.

---

## Mock policy

Seed the **business object** (INV-001, ACME, $100k, Lender A/B).  
Never seed the **protocol verdict**.

Always-on chip: Coston2 · Phala TDX · demo invoices · not a legal receivable.

---

## Tests (all six)

| Attack | Primary proof |
|---|---|
| 1 duplicate pledge | forge + Go + e2e |
| 2 altered amount | Go golden hash + forge consume C≠C′ |
| 3 altered debtor | same, own fixture |
| 4 expired CHECK | forge `vm.warp` |
| 5 unauthorized release | forge `msg.sender` |
| 6 duplicate requestId | on-chain bitmap + Go + one e2e double-send |

UI attack button is extra. It does not replace tests.

---

## Deploy

Enclave: **Phala Cloud**. `npx phala deploy -n cleat -c phala-compose.yml -t tdx.medium --wait`. Intel TDX. Attest with `phala cvms attestation <cvm-id>`. Public CVM URL is `EXT_PROXY_URL`.

What runs inside the CVM: official `redis` + `ext-proxy` + Go `extension-tee`. Images must be pullable (no local `build:` on Phala). Compose overlay; do not delete `docker-compose.yaml`.

Coston2: `LOCAL_MODE=false`. InstructionSender / PledgeRegistry / FDC stay on Flare.

Do **not** register `GCP_AMD_SEV` or `GCP_INTEL_TDX`. Phala quotes are not Google Confidential Space quotes. Flare `register-tee` still uses the scaffold path (`TEST_PLATFORM` / `MODE=1`) because FTDC only verifies GCP attestations. Hardware isolation is Phala TDX. Say both. Do not claim production GCP FCC.

Pitch: the book is decrypted only inside the Phala CVM. CHECK/PLEDGE bind on Coston2. Proof of the enclave is the Phala attestation, not a fake `GCP_AMD_SEV` string.

Laptop compose is handler tests. Live demo is the Phala CVM.

FCC addresses from `config/coston2/deployed-addresses.json` until FCC is enshrined. Enshrined protocols from Contract Registry.
