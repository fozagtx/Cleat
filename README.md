<p align="center">
  <img src="./web/app/icon.svg" alt="Cleat logo" width="88" height="88">
</p>

# Cleat

Check whether one invoice is already pledged without sending the lender your whole customer list.

Cleat is a Flare Confidential Compute application for receivables financing. A borrower selects one invoice. A lender receives one narrow answer: already pledged, or clear to fund. Customer names, amounts, and the rest of the receivables book are not published on-chain.

> [!IMPORTANT]
> Cleat is under active development. The web app, server routes, contracts, and Go extension are implemented. The production TEE still requires external FTDC promotion before the complete Coston2 path can be presented as live.

## What is it?

Cleat has five parts:

1. **Next.js application:** Landing, borrower, lender, activity, and server-only API routes in one deployment.

2. **Confidential state machine:** A Go package implementing `CHECK`, `PLEDGE`, `RELEASE`, and `STATUS` over pledge and financing state.

3. **Flare Confidential Compute extension:** The official FCC scaffold, configured to use Go. This is the private execution boundary.

4. **Coston2 contracts:** The deployed instruction sender, verification gateway, pledge registry, and financing registry.

5. **GCP Confidential Space deployment:** A production SEV workload connected to a self-hosted Coston2 indexer and extension proxy.

The TEE and on-chain registry are the trust path. Next.js server routes and PostgreSQL are application infrastructure, not the source of an eligibility answer.

## How it works

The intended protocol flow is:

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

## Why use it?

- Share one financing answer instead of an aging report.
- Prevent duplicate active pledges inside the Cleat registry.
- Keep private invoice fields out of calldata and explorer pages.
- Bind protocol actions to wallet identities and consume request IDs once.
- Keep application storage separate from protocol authority.

Cleat proves registry-local pledge state. It does not prove that an invoice is real, legally owned, globally unique, collectible, or paid in fiat.

## Current status

| Area | Status |
|---|---|
| Landing page and responsive desk | Working |
| MetaMask connection with wagmi and viem | Working |
| Borrower invoice list | Working when invoices have been ingested |
| Lender check and pledge UI | Submits wallet transactions directly to Coston2 |
| Activity history | Records transactions only after Coston2 verification |
| Next.js server API | Working with Prisma and PostgreSQL in the web deployment |
| Prisma schema and Neon database | Working; not protocol authority |
| Go pledge and financing state machine | Implemented and tested |
| FCC extension routing | Cleat commands implemented and tested |
| Cleat Solidity instruction functions | Implemented and deployed to Coston2 |
| Verification and pledge registries | Implemented and deployed to Coston2 |
| FDC settlement release | Designed, not implemented |
| GCP Confidential Space deployment | Running on AMD SEV; on-chain machine initialized, awaiting external FTDC promotion proof |

When `EXT_PROXY_URL` or `DIRECT_API_KEY` is absent, confidential delivery returns `503`. The application never seeds `eligible`, `ACTIVE`, or a fake transaction hash.

### Coston2 deployment

Extension ID: `0x00000000000000000000000000000000000000000000000000000000000102e7`

FCC workload image:
`us-central1-docker.pkg.dev/cleat-505513/cleat/extension-tee@sha256:008c8c2dbf56f3bb27bc2efd3b77eb0e628ff898a3200ff095e5dbdf6f735e45`

Extension proxy: [`https://cleat.34.70.0.65.sslip.io`](https://cleat.34.70.0.65.sslip.io/info)

TEE ID: `0x696e2Af4fA8Bc9CCB6017440A80861e338B91bD1` (initialized on Coston2; not yet promoted to active because the external FTDC availability proof has not been produced)

| Contract | Address |
|---|---|
| Cleat instruction sender | [`0xb2289168d6B5d7823060d2eAC676d24917b3bEdC`](https://coston2-explorer.flare.network/address/0xb2289168d6B5d7823060d2eAC676d24917b3bEdC) |
| Pledge registry | [`0x4D2B2C08D7c20fE693742B0b1Cfa654eC8C8584f`](https://coston2-explorer.flare.network/address/0x4D2B2C08D7c20fE693742B0b1Cfa654eC8C8584f) |
| Financing registry | [`0xFE23320784cEad1B697b7791Ebc8A387EC5dC239`](https://coston2-explorer.flare.network/address/0xFE23320784cEad1B697b7791Ebc8A387EC5dC239) |
| Verification gateway | [`0x79625E5EEbb27A76A3Cc01231d25d29263a07f88`](https://coston2-explorer.flare.network/address/0x79625E5EEbb27A76A3Cc01231d25d29263a07f88) |

## Requirements

For the web demo:

- Node.js and npm
- A browser wallet such as MetaMask

For the FCC stack:

- Go
- Docker Desktop
- Foundry
- `jq` and `curl`
- Google Cloud CLI
- A funded Coston2 deployment wallet

## Quick start

### Run the local product

Install and start the application:

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The UI and `/api/*` routes run in the same Next.js process.

Check API health:

```bash
curl http://localhost:3000/api/health
```

### Prepare FCC configuration

```bash
cp .env.example .env
```

Set at least:

```dotenv
LANGUAGE=go
CHAIN_URL=https://coston2-api.flare.network/ext/C/rpc
ADDRESSES_FILE=./config/coston2/deployed-addresses.json
LOCAL_MODE=false
SIMULATED_TEE=false
MODE=0
REHYDRATION_ENABLED=true
PLEDGE_REGISTRY_ADDRESS=0x4D2B2C08D7c20fE693742B0b1Cfa654eC8C8584f
REHYDRATION_FROM_BLOCK=34054987
INITIAL_OWNER=0x...
DEPLOYMENT_PRIVATE_KEY=...
EXT_PROXY_URL=https://...
```

> [!WARNING]
> Never commit `.env`, deployment keys, proxy keys, or database credentials. Replace all sample and placeholder values before using a public network.

The contracts, proxy, and Confidential Space workload are deployed on Coston2. Do not present the protocol as live until Flare's external FTDC availability proof promotes the initialized TEE and the wallet submission path is verified end to end.

## Configuration

### Next.js server routes

| Variable | Default | Purpose |
|---|---|---|
| `EXT_PROXY_URL` | empty | FCC extension proxy base URL |
| `DIRECT_API_KEY` | none | Server-only credential for confidential `/direct` delivery |
| `DATABASE_URL` | none | Prisma PostgreSQL connection string |
| `CHAIN_URL` | Coston2 public RPC | Transaction verification RPC |
| `INSTRUCTION_SENDER` | deployed Coston2 sender | Expected transaction destination |

These variables are server-only. The browser calls same-origin `/api/*` routes and receives none of these credentials.

### FCC and Coston2

| Variable | Purpose |
|---|---|
| `LANGUAGE` | Extension implementation. Cleat uses `go`. |
| `CHAIN_URL` | Coston2 RPC endpoint |
| `ADDRESSES_FILE` | Flare FCC deployment addresses |
| `INITIAL_OWNER` | Initial extension owner |
| `DEPLOYMENT_PRIVATE_KEY` | Contract deployment and calls |
| `PROXY_PRIVATE_KEY` | Proxy signer |
| `EXT_PROXY_URL` | Public extension proxy URL |
| `LOCAL_MODE` | `false` for Coston2 |
| `SIMULATED_TEE` | Flare registration mode |
| `REHYDRATION_ENABLED` | Load authoritative pledge events before accepting requests |
| `PLEDGE_REGISTRY_ADDRESS` | Coston2 pledge registry used for rehydration |
| `REHYDRATION_FROM_BLOCK` | First block scanned for pledge events |
| `GOVERNANCE_SIGNERS` | Comma-separated governance addresses |
| `GOVERNANCE_THRESHOLD` | Required governance signatures |

See [`.env.example`](.env.example) for the complete list.

## State model

Pledge state:

```text
UNPLEDGED --> ACTIVE --> RELEASED
                  \
                   --> DEFAULT
```

Financing history:

```text
ACTIVE --> REPAID
       --> DEFAULTED
       --> CANCELLED
```

Rules:

- `ACTIVE -> ACTIVE` is forbidden.
- `RELEASED -> ACTIVE` creates a new financing record.
- `DEFAULT -> ACTIVE` is forbidden in v1.
- A defaulted invoice is ineligible, but its reason is not `ALREADY_PLEDGED`.
- Empty TEE memory must never be interpreted as `UNPLEDGED`.

## Privacy and trust boundaries

Cleat uses two identifiers:

- `invoiceId` identifies the invoice inside the confidential system. It must never be placed on-chain.
- `commitment = H(invoiceId, secretNonce)` is the public handle.

The browser supplies private invoice fields to the confidential path. The on-chain instruction carries only a commitment and consume-once `requestId`.

The Next.js server routes may store encrypted application data, UI state, and audit records. They must not:

- Decrypt invoice fields
- Decide eligibility
- Write authoritative pledge state
- Invent protocol results
- Expose borrower invoice fields through lender or activity responses

## Routes

| Route | Job |
|---|---|
| `/` | Explain Cleat and connect a wallet |
| `/borrower` | View demo receivables |
| `/lender` | Check and pledge one invoice |
| `/activity` | View check and pledge attempts |

The landing page has no dashboard Connect button. Its Review CTA invokes the wallet connector directly. The work desk keeps navigation, theme, and wallet controls in a collapsible sidebar.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Database and proxy configuration health |
| `GET` | `/api/tee/info` | Public TEE encryption identity |
| `GET`, `POST` | `/api/invoices` | Persisted borrower invoices and signed confidential creation |
| `GET` | `/api/lender/invoices/:id` | Redacted lender view |
| `GET` | `/api/activity` | Verified transaction history |
| `POST` | `/api/activity/transactions` | Verify and record a Coston2 instruction |

## Repository map

```text
contracts/                   FCC instruction sender and interfaces
go/                          Selected Go TEE implementation
go/internal/machine/         Cleat pledge and financing state machine
web/                         Next.js product, API routes, and Prisma schema
scripts/                     Build, test, register, and lifecycle commands
tools/                       Go deployment and verification tools
config/                      Coston and Coston2 addresses and proxy templates
docker-compose.yaml          Official local FCC service stack
docker-compose.product.yaml  PostgreSQL overlay
indexer.Dockerfile           Self-hosted Coston2 indexer image
proxy/                       Pinned FCC proxy images and GCP configuration
CONTEXT.md                   Protocol and architecture decisions
```

## Useful commands

### Web

```bash
cd web
npm run dev
npm run lint
npx tsc --noEmit
npm run build
npm run prisma:generate
npm run prisma:migrate
```

### Go and FCC scaffold

```bash
./scripts/test-unit.sh go
./scripts/generate-bindings.sh
cd tools && go build ./...
```

### Local FCC services

After the extension and contracts are wired and `.env` is complete:

```bash
./scripts/start-services.sh --chain coston2
./scripts/test.sh
./scripts/stop-services.sh
```

### PostgreSQL overlay

```bash
docker compose \
  -f docker-compose.yaml \
  -f docker-compose.coston2.yaml \
  -f docker-compose.product.yaml \
  up
```

## Important limits

- Cleat checks uniqueness only inside its own registry.
- No sample invoices or protocol verdicts are seeded. Invoice ingestion must come from an authenticated integration or an explicit operator workflow.
- The current frontend is not evidence that the confidential protocol is complete.
- The Go machine stores private working state in memory and rebuilds public pledge state from Coston2 after a restart.
- Invoice encryption and the `/direct` delivery path are not implemented.
- CHECK, PLEDGE, RELEASE, and STATUS are implemented, but the live TEE-to-contract path is not operational yet.
- FDC settlement verification is not implemented.
- The Prisma schema is not authoritative protocol state.
- No part of this demo is a UCC filing or legal assignment.

## Development order

Remaining protocol work:

1. Bind RELEASE to verified settlement evidence.
2. Resume the saved TEE registration after Coston2 relay providers publish the FTDC availability proof.
3. Verify the complete wallet-to-TEE-to-contract Coston2 path.

The architecture and invariants are specified in [`CONTEXT.md`](CONTEXT.md).

## Built on

- [Flare Confidential Compute](https://dev.flare.network/fcc/overview)
- Coston2, chain ID `114`
- GCP Confidential Space on AMD SEV
- Next.js, Go, Solidity, Prisma, wagmi, and viem
