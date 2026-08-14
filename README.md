<p align="center">
  <img src="./web/public/cleat-logo.png" alt="Cleat logo" width="88" height="88">
</p>

# Cleat

A lender checks one invoice. They get already pledged or clear to fund. They do not get the rest of the book.

Cleat is a receivables desk on [Flare Confidential Compute](https://dev.flare.network/fcc/overview), built for [Flare Summer Signal](https://dorahacks.io/hackathon/flaresummersignal/detail) (Confidential Compute Apps). It is for factors and invoice financiers who have to refuse a duplicate pledge without taking a full aging report. Borrowers use it to prove one receivable is free to fund without publishing customer names or amounts.

**App:** [cleat-finance.vercel.app](https://cleat-finance.vercel.app) · Coston2

TEE identity: [/api/tee/info](https://cleat-finance.vercel.app/api/tee/info) · FCC proxy: [/api/fcc-proxy/info](https://cleat-finance.vercel.app/api/fcc-proxy/info)

Architecture: [`CONTEXT.md`](CONTEXT.md) · Image build: [`REPRODUCIBILITY.md`](REPRODUCIBILITY.md)

## On Flare

Confidential Compute is the product, not a wrapper. Invoice fields are sealed to a measured Go extension. `CHECK`, `PLEDGE`, `RELEASE`, and `STATUS` run in GCP Confidential Space (AMD SEV). Coston2 sees only a commitment and a consume-once request ID. `VerificationGateway` is the only writer to `PledgeRegistry`.

The machine is FTDC-promoted to production (status `2`) under extension `66279`. FDC settlement proofs and FTSO quotes are specified and not in this demo.

Nothing here existed before the program. The work is the Go state machine on Flare's FCC scaffold, four Coston2 contracts, the Next.js desk, the Confidential Space workload, a self-hosted indexer and proxy, and a live CHECK whose verdict comes from the enclave, not from Postgres.

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

`CHECK` is read-only. `PLEDGE` checks and sets atomically. `RELEASE` closes a live pledge. The chain must not receive invoice names, amounts, due dates, or ciphertext.

Cleat proves registry-local uniqueness. It does not prove the invoice is real, legally owned, globally unique, or paid in fiat.

## Deployment

| | |
|---|---|
| Network | Coston2 (`114`) |
| Extension | `66279` (`0x…0102e7`) |
| TEE | [`0xEc5A7a69dAdBCD7d2D323619E25eB7f892f22463`](https://coston2-explorer.flare.network/address/0xEc5A7a69dAdBCD7d2D323619E25eB7f892f22463) · production · policy `5940` |
| Platform | `GCP_AMD_SEV` |
| Workload | `us-central1-docker.pkg.dev/cleat-505513/cleat/extension-tee@sha256:008c8c2dbf56f3bb27bc2efd3b77eb0e628ff898a3200ff095e5dbdf6f735e45` |
| Code hash | `0xbc436fcddb3ce63b59223c6bc39652ee4cf3355990ebccb25f5084bc07e502dc` |
| FlareTeeManager | [`0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`](https://coston2-explorer.flare.network/address/0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE) |
| Instruction sender | [`0xb2289168d6B5d7823060d2eAC676d24917b3bEdC`](https://coston2-explorer.flare.network/address/0xb2289168d6B5d7823060d2eAC676d24917b3bEdC) |
| Pledge registry | [`0x4D2B2C08D7c20fE693742B0b1Cfa654eC8C8584f`](https://coston2-explorer.flare.network/address/0x4D2B2C08D7c20fE693742B0b1Cfa654eC8C8584f) |
| Financing registry | [`0xFE23320784cEad1B697b7791Ebc8A387EC5dC239`](https://coston2-explorer.flare.network/address/0xFE23320784cEad1B697b7791Ebc8A387EC5dC239) |
| Verification gateway | [`0x79625E5EEbb27A76A3Cc01231d25d29263a07f88`](https://coston2-explorer.flare.network/address/0x79625E5EEbb27A76A3Cc01231d25d29263a07f88) |
| Proxy | [cleat.34.70.0.65.sslip.io](https://cleat.34.70.0.65.sslip.io/info) |
| Provider URL | [cleat-finance.vercel.app/api/fcc-proxy](https://cleat-finance.vercel.app/api/fcc-proxy/info) |

## Next

1. Bind `RELEASE` to a verified FDC settlement event.
2. Add FTSO quotes for cross-currency facilities.
3. Closed pilot with one factor, then the same measured image on Flare mainnet.

## Quick start

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The live path is the Vercel app on Coston2.

```bash
cp .env.example .env
./scripts/start-services.sh --chain coston2
```

> [!WARNING]
> Never commit `.env`, keys, or database credentials.

Production uses `LANGUAGE=go`, `LOCAL_MODE=false`, `SIMULATED_TEE=false`, `MODE=0`, `GCP_AMD_SEV`. Full flags: [`.env.example`](.env.example).

| Variable | Purpose |
|---|---|
| `EXT_PROXY_URL` | Extension proxy |
| `DIRECT_API_KEY` | `/direct` delivery |
| `DATABASE_URL` | Prisma (UI only, not protocol authority) |
| `CHAIN_URL` | Coston2 RPC |
| `INSTRUCTION_SENDER` | Expected tx destination |

## State

Pledge: `UNPLEDGED --> ACTIVE --> RELEASED` or `ACTIVE --> DEFAULT`.

Financing: `ACTIVE --> REPAID | DEFAULTED | CANCELLED`.

`ACTIVE -> ACTIVE` is forbidden. `RELEASED -> ACTIVE` is a new financing row. `DEFAULT -> ACTIVE` is forbidden. Empty TEE memory is not `UNPLEDGED`.

`invoiceId` never goes on-chain. `commitment = H(invoiceId, secretNonce)` is the public handle. The Next.js server must not decrypt fields, decide eligibility, or invent a verdict.

## Repo

```text
contracts/            Instruction sender and registries
go/                   TEE + pledge/financing machine
web/                  Next.js desk and API
scripts/ tools/       Build, register, verify
proxy/                Extension proxy
CONTEXT.md            Protocol lock
```

```bash
cd web && npm run lint && npx tsc --noEmit
./scripts/test-unit.sh go
./scripts/generate-bindings.sh
```

Uniqueness is only inside this registry. No invoices or verdicts are seeded. FDC settlement is not implemented. This is not a UCC filing.
