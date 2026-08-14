# HANDOFF — Cleat

**For the next agent.** Read this, then `CONTEXT.md`. Do not rebuild the old FAssets mint desk. Do not rename the product.

**Workspace:** `/Users/kaizen/Desktop/flarehackathon`  
**Deadline:** 2026-08-14 19:59 (Flare Summer Signal / DoraHacks)  
**Never git push until the user says so. Never commit unless asked.**

---

## What this is

**Cleat** — Confidential Compute Apps bounty (not Interoperable Asset Products).

Lender gets `eligible = true|false` for a private receivable, without seeing the borrower’s book. That is the whole product.

Hero: Flare Confidential Compute (Go extension) + Coston2 (114).  
Enclave hardware: **Phala Cloud Intel TDX**, not GCP Confidential Space.  
Secondary: FDC on RELEASE. FTSO is a quote hook, not eligibility.

Architecture lock: [`CONTEXT.md`](CONTEXT.md). That file wins on protocol questions.

---

## User locks (do not reopen)

| Lock | Value |
|---|---|
| Product name | **Cleat**. Not Unpledged. `UNPLEDGED` is only a pledge *status*. |
| `OP_TYPE` | `CLEAT` |
| TEE language | `LANGUAGE=go` only. Do not port CHECK/PLEDGE to Python/TS. |
| Enclave | Phala Cloud CVM (`tdx.medium` for live). Laptop Docker for handlers. |
| FCC vs Phala | Phala ≠ Flare TEE registration. Do **not** stamp `GCP_AMD_SEV` / `GCP_INTEL_TDX`. Flare `register-tee` stays `TEST_PLATFORM` / `MODE=1`. Pitch: book dies in Phala TDX; CHECK/PLEDGE bind on Coston2. |
| Mock invoices | Allowed (INV-001, ACME, $100k, Lender A/B). |
| Mock protocol | **Forbidden.** Attack UI must hit live CHECK/PLEDGE. No `setTimeout` → BLOCKED. Do not seed `ALREADY_PLEDGED`. |
| Time cuts | **Forbidden.** Do not skip Postgres, FDC, salt, FinancingRegistry, or the six tests “because of the deadline.” |
| Invoices on-chain | Never. No encrypted blobs on-chain as the privacy model. |
| FAssets / Smart Accounts | Not in v1. |
| Financier | `msg.sender` of `sendPledge`. Never a client-supplied field. |
| Wallet | wagmi + viem + `injected()` MetaMask. RainbowKit burned on old Cleat. |

---

## Spine (already the repo root)

Official `flare-foundation/fce-extension-scaffold` **is** this directory. Do not nest under `fce-extension/`. Do not delete official scripts.

```
go/ python/ typescript/     TEE languages (only customize Go)
contracts/                  InstructionSender + product registries
scripts/ tools/             official FCC lifecycle
web/                        Next.js  (no language.env)
backend/                   Fastify + Prisma (no language.env)
phala-compose.yml           Phala overlay (pullable images)
docker-compose.yaml         official redis + ext-proxy + extension-tee
docker-compose.product.yaml Postgres overlay
CONTEXT.md                  architecture
HANDOFF.md                  this file
```

Go module path is still `extension-scaffold`. Leave it. Product name is Cleat; contract is `CleatInstructionSender`.

---

## What is already done

- Old FAssets apps (`01-cleat`, `03-hold-the-vault`) deleted. This repo is the FCC scaffold.
- `CONTEXT.md` written (council + user overrides).
- Scaffold renamed: `HelloWorldInstructionSender` → `CleatInstructionSender`, Go bindings package `helloworld` → `cleat`.
- `.env` created from `.env.example` (`LANGUAGE=go`, Coston2). Keys are placeholders until the user fills them.
- `go/internal/config/config.go` already has `OPTypeCleat = "CLEAT"` plus CHECK/PLEDGE/RELEASE/STATUS. GREETING/SAY_* still exist (Hello World handlers still live).
- `go/internal/machine/` — dual state machine + tests. **Not wired** into `extension.go` yet. `extension.go` is still SAY_HELLO / SAY_GOODBYE.
- `web/` Next.js App Router stub. `backend/` Fastify + Prisma stub.
- `phala-compose.yml` + `docker-compose.product.yaml` stubs.

## What is not done (do this, in order)

1. **Wire CLEAT into the TEE** — `extension.go` routes CHECK/PLEDGE/RELEASE/STATUS to `internal/machine`. Decrypt via `SIGN_PORT` `/decrypt` (base64). Do not roll your own ECIES.
2. **Solidity** — keep frozen ctor / `setExtensionId` / `_getExtensionId`. Replace GREETING send fns with `sendCheck` / `sendPledge` / `sendRelease`. Add `VerificationGateway.sol`, `PledgeRegistry.sol`, `FinancingRegistry.sol`. Then `./scripts/generate-bindings.sh`.
3. **Channels** — browser ECIES to TEE pubkey from `/info` → `POST /direct`. On-chain `message` = commitment + requestId only.
4. **Backend** — eight Prisma tables. Eligibility never from SQL. Seed INV-001. Do not seed eligible/ACTIVE.
5. **Frontend** — exactly `/` `/borrower` `/lender` `/activity`. Two-panel lender. Live attack panel. “Powered by Flare Confidential Compute.”
6. **FDC** — RELEASE via `EVMTransaction` / `testFLR`, ref = commitment. Not an invoice oracle. Not Web2Json against our API.
7. **Tests** — all six attacks (see CONTEXT). Replace Hello World conformance fixtures when ops change.
8. **Phala** — user signs up at [cloud.phala.com/register](https://cloud.phala.com/register) (free credits, no card). API key → `npx phala login`. Images in `phala-compose.yml` must be **pullable** (no `build:`). `tdx.small` to stretch free credits; `tdx.medium` for the three-container stack if it fits.

---

## Protocol cheat sheet (details in CONTEXT.md)

Commands: `CHECK` `PLEDGE` `RELEASE` `STATUS` + protocol `DEFAULT`.  
Pledge: `UNPLEDGED | ACTIVE | RELEASED | DEFAULT`.  
Financing: `ACTIVE | REPAID | DEFAULTED | CANCELLED`.  
`ACTIVE → ACTIVE` forbidden. `RELEASED → ACTIVE` = new financing row. `DEFAULT → ACTIVE` forbidden.

Two hashes: `invoiceId` (TEE only) and `commitment = H(invoiceId, secretNonce)` (on-chain). `abi.encode` + domain separator.

Replay: `requestId = instructionId`, consume-once on `VerificationGateway`, `validUntil = now + 10 minutes`.

---

## Local vs live

| | Laptop | Live demo |
|---|---|---|
| Hardware | Docker Desktop | Phala TDX CVM |
| `SIMULATED_TEE` / `MODE` | `true` / `1` | still `true` / `1` for Flare registry |
| Enclave proof | none | `phala cvms attestation <id>` |
| Chain | Coston2 114 | Coston2 114 |
| Proxy URL | tunnel or Phala ingress | Phala CVM HTTPS → `EXT_PROXY_URL` |

Official FCC Hello World on Coston2 also uses simulated Flare attestation + a public URL. We keep that Flare path and put the processes inside Phala.

Docker Desktop must be running for local compose (`docker info`).

---

## Commands

```bash
# unit (Go)
./scripts/test-unit.sh

# after Solidity changes
./scripts/generate-bindings.sh
cd tools && go build ./...

# local FCC stack (needs Docker + filled .env)
./scripts/start-services.sh --chain coston2

# Phala (after API key + pullable images)
npx phala login
npx phala deploy -n cleat -c phala-compose.yml -t tdx.small --wait
```

`.env` is gitignored. Fill `DEPLOYMENT_PRIVATE_KEY`, `INITIAL_OWNER`, `EXT_PROXY_URL`. Do not commit secrets.

Coston2 indexer DB creds go in `config/proxy/extension_proxy.coston2.docker.toml` (also gitignored; copy the `.example`).

---

## Skills for the next session

- `frontend-design` + `frontend-design-guidelines` when building `web/`
- `page-load-animations` / `web-animation-guidelines` for page-level UI
- `number-formatting` for amounts
- FCC in-repo: `.claude/skills/create-extension` (ops + handlers), `verify-deploy` at Coston2 time
- Do **not** load FAssets / mint / RainbowKit paths

---

## Do not

- Rebuild FAssets mint completion or Levy claim-default
- Set `LANGUAGE=typescript` because the UI is TS
- Put INV-001 / ACME / $100k on `/lender` result, `/activity`, or calldata
- Claim production GCP confidential compute
- Claim the invoice is legally real
- Skip dual-state (PledgeRegistry + TEE). Empty TEE RAM ≠ UNPLEDGED
- Let Fastify write PledgeRegistry
- Fake explorer hashes or protocol verdicts
