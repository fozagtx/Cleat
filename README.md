<p align="center">
  <img src="./web/public/cleat-logo.png" alt="Cleat logo" width="88" height="88">
</p>

# Cleat

A confidential pledge check for invoice lenders to fund one receivable without seeing the customer list.

Customer names, amounts, due dates, and every other invoice stay in Flare Confidential Compute. The lender only learns **already pledged here, or free to fund.**

A company wants a loan against one unpaid invoice. Today they send the whole aging report. Cleat answers that one question instead.

Receivables desk on [Flare Confidential Compute](https://dev.flare.network/fcc/overview). Built for [Flare Summer Signal](https://dorahacks.io/hackathon/flaresummersignal/detail), Confidential Compute Apps.

| | |
|---|---|
| For | Lenders who will not fund an invoice that is already collateral |
| Also | Borrowers who will not send their full customer list to get that answer |
| App | [cleat-finance.vercel.app](https://cleat-finance.vercel.app) |
| TEE `/info` | [cleat-finance.vercel.app/api/tee/info](https://cleat-finance.vercel.app/api/tee/info) |
| FCC proxy | [cleat-finance.vercel.app/api/fcc-proxy/info](https://cleat-finance.vercel.app/api/fcc-proxy/info) |
| Network | Coston2 (`114`) |
| Spec | [`CONTEXT.md`](CONTEXT.md) · [`REPRODUCIBILITY.md`](REPRODUCIBILITY.md) |

## Stack

```text
  Borrower                         Lender
      |                               |
      v                               v
 +--------------------------------------------------+
 |            Next.js desk (Vercel)                 |
 |     /borrower              /lender               |
 +------------------+-------------------------------+
                    |
         +----------+-----------+
         |                      |
         v                      v
   POST /direct            sendCheck / sendPledge
   sealed invoice          commitment + requestId
         |                      |
         v                      v
 +------------------+    +---------------------------+
 | GCP Confidential |    | Coston2                   |
 | Space (AMD SEV)  |    | InstructionSender         |
 |                  |    | VerificationGateway       |
 | Go TEE           |<-->| PledgeRegistry            |
 | CHECK PLEDGE     |    | FinancingRegistry         |
 | RELEASE STATUS   |    +---------------------------+
 +------------------+
         ^
         |
 +-------+--------+
 | self-hosted    |
 | indexer+proxy  |
 +----------------+
```

## On Flare

| Piece | Job in Cleat |
|---|---|
| FCC / TEE | Seals invoice fields. Runs `CHECK`, `PLEDGE`, `RELEASE`, `STATUS`. Lender never sees the book. |
| Coston2 | Stores `commitment` + consume-once `requestId` only. Gateway is the sole writer to the pledge registry. |
| FTDC | Promoted this machine to production (status `2`, extension `66279`). |
| FDC | Settlement proof for `RELEASE`. Specified, not in the demo. |
| FTSO | Cross-currency quotes. Specified, not in the demo. |

Confidential Compute is the product, not a wrapper. Nothing here existed before the program.

| Built | What it is |
|---|---|
| Go extension | FCC scaffold + pledge/financing machine |
| Contracts | Sender, gateway, pledge registry, financing registry |
| Desk | Next.js borrower/lender UI, wallet txs, `/direct` seal |
| Enclave | Confidential Space workload, indexer, proxy, FTDC-active TEE |
| Proof | Live CHECK; verdict from the enclave, not Postgres |

## Check path

```text
  select invoice
         |
         v
  +------------------+     +---------------------------+
  | salt commitment  |     | encrypt fields to TEE key |
  +--------+---------+     +-------------+-------------+
           |                             |
           +--------------+--------------+
                          |
                          v
              +-----------+-----------+
              |                       |
              v                       v
        /direct (secret)        sendCheck (public)
              |                       |
              +-----------+-----------+
                          |
                          v
                    Go TEE CHECK
                          |
              +-----------+-----------+
              |                       |
              v                       v
       ALREADY_PLEDGED          CLEAR_TO_FUND
```

`CHECK` is read-only. `PLEDGE` checks and sets. `RELEASE` closes a live pledge. Names, amounts, due dates, and ciphertext stay off-chain.

Registry-local uniqueness only. Not a proof the invoice is real, owned, globally unique, or paid.

## State

```text
Pledge

  UNPLEDGED -----> ACTIVE -----> RELEASED
                     |
                     +---------> DEFAULT


Financing

  ACTIVE -----> REPAID
           |--> DEFAULTED
           +--> CANCELLED
```

| Rule | |
|---|---|
| `ACTIVE -> ACTIVE` | Forbidden |
| `RELEASED -> ACTIVE` | New financing row |
| `DEFAULT -> ACTIVE` | Forbidden in v1 |
| Empty TEE RAM | Not `UNPLEDGED` |
| `invoiceId` | TEE only, never on-chain |
| `commitment` | `H(invoiceId, secretNonce)` |

The Next.js server must not decrypt fields, decide eligibility, or invent a verdict.

## Deployment

| Contract | Address |
|---|---|
| FlareTeeManager | [`0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`](https://coston2-explorer.flare.network/address/0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE) |
| Instruction sender | [`0xb2289168d6B5d7823060d2eAC676d24917b3bEdC`](https://coston2-explorer.flare.network/address/0xb2289168d6B5d7823060d2eAC676d24917b3bEdC) |
| Pledge registry | [`0x4D2B2C08D7c20fE693742B0b1Cfa654eC8C8584f`](https://coston2-explorer.flare.network/address/0x4D2B2C08D7c20fE693742B0b1Cfa654eC8C8584f) |
| Financing registry | [`0xFE23320784cEad1B697b7791Ebc8A387EC5dC239`](https://coston2-explorer.flare.network/address/0xFE23320784cEad1B697b7791Ebc8A387EC5dC239) |
| Verification gateway | [`0x79625E5EEbb27A76A3Cc01231d25d29263a07f88`](https://coston2-explorer.flare.network/address/0x79625E5EEbb27A76A3Cc01231d25d29263a07f88) |

| Infra | |
|---|---|
| TEE | [`0xEc5A7a69dAdBCD7d2D323619E25eB7f892f22463`](https://coston2-explorer.flare.network/address/0xEc5A7a69dAdBCD7d2D323619E25eB7f892f22463) · production · policy `5940` |
| Extension | `66279` (`0x…0102e7`) |
| Platform | `GCP_AMD_SEV` |
| Workload | `…/extension-tee@sha256:008c8c2dbf56f3bb27bc2efd3b77eb0e628ff898a3200ff095e5dbdf6f735e45` |
| Code hash | `0xbc436fcddb3ce63b59223c6bc39652ee4cf3355990ebccb25f5084bc07e502dc` |
| Proxy | [cleat.34.70.0.65.sslip.io](https://cleat.34.70.0.65.sslip.io/info) |
| Provider URL | [cleat-finance.vercel.app/api/fcc-proxy](https://cleat-finance.vercel.app/api/fcc-proxy/info) |

## Next

| | |
|---|---|
| 1 | Bind `RELEASE` to a verified FDC settlement event |
| 2 | FTSO quotes for cross-currency facilities |
| 3 | Closed pilot with one factor, then the same image on Flare mainnet |

## Quick start

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Live path is the Vercel app on Coston2.

```bash
cp .env.example .env
./scripts/start-services.sh --chain coston2
```

> [!WARNING]
> Never commit `.env`, keys, or database credentials.

`LANGUAGE=go`, `LOCAL_MODE=false`, `SIMULATED_TEE=false`, `MODE=0`, `GCP_AMD_SEV`. Flags: [`.env.example`](.env.example).

| Variable | Purpose |
|---|---|
| `EXT_PROXY_URL` | Extension proxy |
| `DIRECT_API_KEY` | `/direct` delivery |
| `DATABASE_URL` | Prisma (UI only) |
| `CHAIN_URL` | Coston2 RPC |
| `INSTRUCTION_SENDER` | Expected tx destination |

## Repo

| Path | |
|---|---|
| `contracts/` | Instruction sender and registries |
| `go/` | TEE + pledge/financing machine |
| `web/` | Next.js desk and API |
| `scripts/` `tools/` | Build, register, verify |
| `proxy/` | Extension proxy |
| `CONTEXT.md` | Protocol lock |

```bash
cd web && npm run lint && npx tsc --noEmit
./scripts/test-unit.sh go
./scripts/generate-bindings.sh
```

Uniqueness is only inside this registry. No invoices or verdicts are seeded. FDC settlement is not implemented. This is not a UCC filing.
