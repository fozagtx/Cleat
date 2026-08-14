# Cleat

Check whether one invoice is already pledged without sending the lender your whole customer list.

Cleat is a Flare Confidential Compute application for receivables financing. A borrower selects one invoice. A lender receives one narrow answer: already pledged, or clear to fund. Customer names, amounts, and the rest of the receivables book are not published on-chain.

> [!IMPORTANT]
> Cleat is under active development. The web app and local API run today. The Cleat state machine exists and has Go tests, but it is not yet wired into the FCC extension or Solidity instruction path. Protocol actions return an explicit error instead of a fabricated verdict.

## What is it?

Cleat has six parts:

1. **Landing and desk:** A Next.js application with borrower invoices, lender review, and activity routes.

2. **Application API:** A Fastify service that reads persisted invoices and records attempted protocol activity. It never decides eligibility.

3. **Confidential state machine:** A Go package implementing `CHECK`, `PLEDGE`, `RELEASE`, and `STATUS` over pledge and financing state.

4. **Flare Confidential Compute extension:** The official FCC scaffold, configured to use Go. This is the private execution boundary.

5. **Coston2 contracts:** The deployed instruction sender, verification gateway, pledge registry, and financing registry.

6. **GCP Confidential Space deployment:** A production SEV workload connected to a self-hosted Coston2 indexer and extension proxy.

The TEE and on-chain registry are the trust path. Fastify and PostgreSQL are application infrastructure, not the source of an eligibility answer.

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
| Lender check and pledge UI | Working UI; protocol call is not wired |
| Activity history | Working for API attempts |
| Fastify API | Working with Prisma and PostgreSQL |
| Prisma schema and Neon database | Working; not protocol authority |
| Go pledge and financing state machine | Implemented and tested |
| FCC extension routing | Cleat commands implemented and tested |
| Cleat Solidity instruction functions | Implemented and deployed to Coston2 |
| Verification and pledge registries | Implemented and deployed to Coston2 |
| FDC settlement release | Designed, not implemented |
| GCP Confidential Space deployment | Running on AMD SEV; on-chain machine initialized, awaiting external FTDC promotion proof |

When `EXT_PROXY_URL` is absent, the API returns `503`. Until wallet submission is wired, protocol requests return `409 CLIENT_SIGNATURE_REQUIRED`. The API never seeds `eligible`, `ACTIVE`, or a fake transaction hash.

### Coston2 deployment

Extension ID: `0x00000000000000000000000000000000000000000000000000000000000102e7`

FCC workload image:
`us-central1-docker.pkg.dev/cleat-505513/cleat/extension-tee@sha256:c1e54c02a3b68fee45af016a89808c7156ac2e217869d4f4ead522039428b18d`

Extension proxy: [`https://34.70.0.65.sslip.io`](https://34.70.0.65.sslip.io/info)

TEE ID: `0x2F6FFbdF37920b297E3b324548CcE9A30A2bC1ad` (initialized on Coston2; not yet promoted to active because the external FTDC availability proof has not been produced)

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
- A funded Coston2 deployment wallet

For a Phala deployment:

- A Phala Cloud account
- Phala CLI authentication
- Publicly pullable proxy and extension images

## Quick start

### Run the local product

Install and start the API:

```bash
cd backend
npm install
npm run dev
```

In another terminal, install and start the web app:

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The web app calls the API at `http://localhost:3001` by default.

Check API health:

```bash
curl http://localhost:3001/health
```

### Run only the frontend

The landing page works without the API:

```bash
cd web
npm install
npm run dev
```

Invoices, Review, and History require the API.

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
INITIAL_OWNER=0x...
DEPLOYMENT_PRIVATE_KEY=...
EXT_PROXY_URL=https://...
```

> [!WARNING]
> Never commit `.env`, deployment keys, proxy keys, database credentials, or Phala credentials. Replace all sample and placeholder values before using a public network.

The contracts, proxy, and Confidential Space workload are deployed on Coston2. Do not present the protocol as live until Flare's external FTDC availability proof promotes the initialized TEE, and chain rehydration plus wallet submission are configured.

## Configuration

### Web

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Fastify API origin |

### Backend

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Fastify port |
| `EXT_PROXY_URL` | empty | FCC extension proxy base URL |
| `DATABASE_URL` | none | Prisma PostgreSQL connection string |

The API reads and writes PostgreSQL through Prisma. `DATABASE_URL` is required.

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

The backend may store encrypted application data, UI state, and audit records. It must not:

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
| `GET` | `/health` | API and proxy configuration health |
| `GET` | `/invoices` | Persisted borrower invoices |
| `GET` | `/lender/invoices/:id` | Redacted lender view |
| `GET` | `/activity` | Protocol attempt history |
| `POST` | `/protocol/:command` | `check`, `pledge`, `release`, or `status` |

Protocol requests currently verify that the proxy is reachable, then stop with `501` because the Cleat instruction path is not registered.

## Repository map

```text
backend/                     Fastify API and Prisma schema
contracts/                   FCC instruction sender and interfaces
go/                          Selected Go TEE implementation
go/internal/machine/         Cleat pledge and financing state machine
web/                         Next.js product
scripts/                     Build, test, register, and lifecycle commands
tools/                       Go deployment and verification tools
config/                      Coston and Coston2 addresses and proxy templates
docker-compose.yaml          Official local FCC service stack
docker-compose.product.yaml  PostgreSQL overlay
phala-compose.yml            Phala Cloud deployment overlay
CONTEXT.md                   Protocol and architecture decisions
HANDOFF.md                   Detailed implementation status
```

The Python and TypeScript extension directories are inherited from the FCC scaffold. Cleat selects Go and does not implement its confidential commands in the other languages.

## Useful commands

### Web

```bash
cd web
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

### Backend

```bash
cd backend
npm run dev
npm run build
npm run prisma:generate
npm run prisma:migrate
```

### Go and FCC scaffold

```bash
./scripts/test-unit.sh go
./scripts/test-conformance.sh go
./scripts/generate-bindings.sh
cd tools && go build ./...
```

The current conformance fixtures validate the inherited greeting handler, not the unfinished Cleat protocol path.

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

## Phala Cloud

`phala-compose.yml` runs Redis, the FCC proxy, and the Go extension inside a Phala CVM.

The images must be published before deployment. Phala does not build local Dockerfiles from the compose file.

```bash
npx phala login
npx phala deploy -n cleat -c phala-compose.yml -t tdx.small --wait
```

Use `tdx.medium` if the three-container stack does not fit. Retrieve hardware attestation with:

```bash
phala cvms attestation <cvm-id>
```

Phala TDX attestation is not GCP Confidential Space attestation. The current Flare registration path remains simulated test mode until Flare supports the relevant attestation type. Do not label Phala evidence as `GCP_AMD_SEV` or `GCP_INTEL_TDX`.

## Important limits

- Cleat checks uniqueness only inside its own registry.
- No sample invoices or protocol verdicts are seeded. Invoice ingestion must come from an authenticated integration or an explicit operator workflow.
- The current frontend is not evidence that the confidential protocol is complete.
- The Go machine currently stores state in memory.
- Rehydration from chain after a TEE restart is not implemented.
- Invoice encryption and the `/direct` delivery path are not implemented.
- CHECK, PLEDGE, RELEASE, and STATUS are implemented, but the live TEE-to-contract path is not operational yet.
- FDC settlement verification is not implemented.
- The Prisma schema is not authoritative protocol state.
- No part of this demo is a UCC filing or legal assignment.

## Development order

Remaining protocol work:

1. Implement browser sealing and confidential `/direct` delivery.
2. Add chain-backed TEE state rehydration.
3. Bind RELEASE to verified settlement evidence.
4. Resume the saved TEE registration after Coston2 relay providers publish the FTDC availability proof.
5. Verify the complete wallet-to-TEE-to-contract Coston2 path.

The architecture and invariants are specified in [`CONTEXT.md`](CONTEXT.md). Current implementation notes are in [`HANDOFF.md`](HANDOFF.md).

## Built on

- [Flare Confidential Compute](https://dev.flare.network/fcc/overview)
- Coston2, chain ID `114`
- Phala Cloud Intel TDX
- Next.js, Fastify, Go, Solidity, Prisma, wagmi, and viem
