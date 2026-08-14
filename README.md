<p align="center">
  <img src="./web/public/cleat-logo.png" alt="Cleat logo" width="88" height="88">
</p>

# Cleat

Check whether one invoice is already pledged without sending the lender your whole customer list.

## Submission

Copy-paste block for [Flare Summer Signal](https://dorahacks.io/hackathon/flaresummersignal/detail).

### Project name

Cleat

### Selected bounty

Bounty 2 — Confidential Compute Apps

### Short product description

Cleat is a receivables-financing desk on Flare Confidential Compute. A borrower seals one invoice. A lender receives one narrow answer: already pledged, or clear to fund. Customer names, amounts, and the rest of the book stay off-chain. The TEE is the trust path. The public chain stores only a commitment and a consume-once request ID.

### Target user

Invoice financiers (lenders and factors) who must refuse a duplicate pledge without receiving the borrower's receivables file. Secondary user: the borrower who needs to prove one invoice is free to fund without publishing the book.

### Demo link, video, or working app link

Working app: [https://cleat-finance.vercel.app](https://cleat-finance.vercel.app)

Public TEE identity: [https://cleat-finance.vercel.app/api/tee/info](https://cleat-finance.vercel.app/api/tee/info)

Public FCC proxy: [https://cleat-finance.vercel.app/api/fcc-proxy/info](https://cleat-finance.vercel.app/api/fcc-proxy/info)

Network: Coston2 (chain ID `114`)

### GitHub repo or technical materials

Repo: [https://github.com/fozagtx/Cleat](https://github.com/fozagtx/Cleat)

Architecture lock: [`CONTEXT.md`](CONTEXT.md)

Reproducible TEE image: [`REPRODUCIBILITY.md`](REPRODUCIBILITY.md)

### How the project uses Flare

Flare Confidential Compute is the product, not a wrapper.

- **FCC / TEE.** Invoice fields are sealed to the measured Go extension. `CHECK`, `PLEDGE`, `RELEASE`, and `STATUS` run inside GCP Confidential Space (AMD SEV). The lender never receives the book.
- **Coston2 instructions.** `InstructionSender` posts only `commitment` + `requestId`. `VerificationGateway` is the only writer to `PledgeRegistry`.
- **FTDC promotion.** The machine is registered and promoted to production through Flare's TEE availability check. Providers reach the extension through the public proxy. Status is `2` (active) under extension ID `66279`.
- **Not used yet.** FDC settlement proofs and FTSO quotes are designed in [`CONTEXT.md`](CONTEXT.md) and are not in this demo.

### What was newly built during the program

This product did not exist before the program. During Flare Summer Signal we built:

- A Go FCC extension on Flare's official scaffold, with a pledge/financing state machine and `CLEAT` commands.
- Four Coston2 contracts: instruction sender, verification gateway, pledge registry, financing registry.
- A Next.js borrower/lender desk that submits wallet transactions to those contracts and delivers sealed invoice fields to `/direct`.
- A production Confidential Space workload, a self-hosted Coston2 indexer and extension proxy, and FTDC registration through to an active TEE.
- A live CHECK on Coston2 against that TEE (verdict returned from the enclave, not from application storage).

Postgres stores UI and audit records only. It is not protocol authority.

### Smart contract addresses and deployment

| Item | Value |
|---|---|
| Network | Coston2 (`114`) |
| Extension ID | `66279` (`0x00000000000000000000000000000000000000000000000000000000000102e7`) |
| TEE ID | [`0xEc5A7a69dAdBCD7d2D323619E25eB7f892f22463`](https://coston2-explorer.flare.network/address/0xEc5A7a69dAdBCD7d2D323619E25eB7f892f22463) (production/active, signing policy `5940`) |
| Platform | `GCP_AMD_SEV` |
| Workload | `us-central1-docker.pkg.dev/cleat-505513/cleat/extension-tee@sha256:008c8c2dbf56f3bb27bc2efd3b77eb0e628ff898a3200ff095e5dbdf6f735e45` |
| Code hash | `0xbc436fcddb3ce63b59223c6bc39652ee4cf3355990ebccb25f5084bc07e502dc` |
| FlareTeeManager | [`0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`](https://coston2-explorer.flare.network/address/0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE) |
| Instruction sender | [`0xb2289168d6B5d7823060d2eAC676d24917b3bEdC`](https://coston2-explorer.flare.network/address/0xb2289168d6B5d7823060d2eAC676d24917b3bEdC) |
| Pledge registry | [`0x4D2B2C08D7c20fE693742B0b1Cfa654eC8C8584f`](https://coston2-explorer.flare.network/address/0x4D2B2C08D7c20fE693742B0b1Cfa654eC8C8584f) |
| Financing registry | [`0xFE23320784cEad1B697b7791Ebc8A387EC5dC239`](https://coston2-explorer.flare.network/address/0xFE23320784cEad1B697b7791Ebc8A387EC5dC239) |
| Verification gateway | [`0x79625E5EEbb27A76A3Cc01231d25d29263a07f88`](https://coston2-explorer.flare.network/address/0x79625E5EEbb27A76A3Cc01231d25d29263a07f88) |
| Extension proxy | [https://cleat.34.70.0.65.sslip.io](https://cleat.34.70.0.65.sslip.io/info) |
| Provider URL | [https://cleat-finance.vercel.app/api/fcc-proxy](https://cleat-finance.vercel.app/api/fcc-proxy/info) |

### Roadmap

1. Bind `RELEASE` to a verified FDC settlement event instead of an operator action.
2. Add FTSO conversion quotes for cross-currency facilities.
3. Run a closed pilot with one factor and a small invoice book, then move the same measured workload to Flare mainnet.

---

## How it works

```text
Borrower selects one invoice
             |
             v
Browser computes a salted commitment
and seals invoice fields for the TEE
             |
             +--------------------------+
             |                          |
             v                          v
POST /direct sends secrets      Coston2 instruction carries
to the confidential path        commitment + requestId only
             |                          |
             +-------------+------------+
                           |
                           v
                 Go TEE runs CHECK
                           |
             +-------------+-------------+
             |                           |
             v                           v
      ALREADY_PLEDGED               CLEAR_TO_FUND
```

`CHECK` is read-only. `PLEDGE` checks and sets atomically. `RELEASE` closes a live pledge as repaid, cancelled, or defaulted. `STATUS` returns public pledge and financing state without invoice fields.

The public chain receives commitments and request identifiers. It must not receive invoice names, customer names, amounts, due dates, or encrypted invoice blobs.

Cleat proves registry-local pledge state. It does not prove that an invoice is real, legally owned, globally unique, collectible, or paid in fiat.

## Current status

| Area | Status |
|---|---|
| Landing page and desk | Working |
| MetaMask / wagmi / viem | Working |
| Borrower invoice ingest | Working when a wallet-signed invoice is posted |
| Lender check and pledge UI | Submits wallet transactions to Coston2 |
| Next.js API + Prisma / Neon | Working; not protocol authority |
| Go pledge and financing machine | Implemented and tested |
| FCC extension routing | Implemented and tested |
| Coston2 contracts | Deployed |
| Confidential Space TEE | Production/active; live CHECK verified |
| FDC settlement release | Designed, not implemented |

When `EXT_PROXY_URL` or `DIRECT_API_KEY` is absent, confidential delivery returns `503`. The application never seeds `eligible`, `ACTIVE`, or a fake transaction hash.

## Quick start

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Health: `curl http://localhost:3000/api/health`.

The live demo is the Vercel app against Coston2. Local FCC services need `.env` from [`.env.example`](.env.example), Docker, Foundry, and a funded Coston2 key.

```bash
cp .env.example .env
./scripts/start-services.sh --chain coston2
```

> [!WARNING]
> Never commit `.env`, deployment keys, proxy keys, or database credentials.

## Configuration

Server-only Next.js variables:

| Variable | Purpose |
|---|---|
| `EXT_PROXY_URL` | FCC extension proxy base URL |
| `DIRECT_API_KEY` | Credential for confidential `/direct` delivery |
| `DATABASE_URL` | Prisma PostgreSQL connection |
| `CHAIN_URL` | Coston2 RPC for transaction verification |
| `INSTRUCTION_SENDER` | Expected transaction destination |

FCC variables are listed in [`.env.example`](.env.example). Production uses `LANGUAGE=go`, `LOCAL_MODE=false`, `SIMULATED_TEE=false`, `MODE=0`, and platform `GCP_AMD_SEV`.

## State model

Pledge: `UNPLEDGED --> ACTIVE --> RELEASED` or `ACTIVE --> DEFAULT`.

Financing: `ACTIVE --> REPAID | DEFAULTED | CANCELLED`.

- `ACTIVE -> ACTIVE` is forbidden.
- `RELEASED -> ACTIVE` creates a new financing record.
- `DEFAULT -> ACTIVE` is forbidden in v1.
- Empty TEE memory must never be interpreted as `UNPLEDGED`.

## Privacy

Two identifiers:

- `invoiceId` identifies the invoice inside the TEE. It must never be placed on-chain.
- `commitment = H(invoiceId, secretNonce)` is the public handle.

The Next.js server must not decrypt invoice fields, decide eligibility, write authoritative pledge state, or invent protocol results.

## Routes

| Route | Job |
|---|---|
| `/` | Explain Cleat and connect a wallet |
| `/borrower` | Ingest and view receivables |
| `/lender` | Check and pledge one invoice |
| `/activity` | View verified check and pledge attempts |

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Database and proxy configuration |
| `GET` | `/api/tee/info` | Public TEE encryption identity |
| `GET`, `POST` | `/api/invoices` | Signed confidential invoice creation |
| `GET` | `/api/lender/invoices/:id` | Redacted lender view |
| `GET` | `/api/activity` | Verified transaction history |
| `POST` | `/api/activity/transactions` | Verify and record a Coston2 instruction |

## Repository map

```text
contracts/                   Instruction sender and product registries
go/                          Go TEE implementation
go/internal/machine/         Pledge and financing state machine
web/                         Next.js product, API routes, Prisma
scripts/                     Build, test, register, lifecycle
tools/                       Deployment and verification tools
config/                      Coston2 addresses
proxy/                       Extension proxy image and GCP config
CONTEXT.md                   Protocol decisions
```

## Useful commands

```bash
cd web && npm run dev && npm run lint && npx tsc --noEmit
./scripts/test-unit.sh go
./scripts/generate-bindings.sh
cd tools && go build ./...
./scripts/test.sh
```

## Limits

- Uniqueness is only inside this registry.
- No sample invoices or protocol verdicts are seeded.
- FDC settlement verification is not implemented.
- Prisma is not authoritative protocol state.
- This is not a UCC filing or legal assignment.

## Built on

- [Flare Confidential Compute](https://dev.flare.network/fcc/overview)
- Coston2, chain ID `114`
- GCP Confidential Space on AMD SEV
- Next.js, Go, Solidity, Prisma, wagmi, and viem
