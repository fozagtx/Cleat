# Cleat product requirements

## Product

Cleat lets a borrower seal one receivable to a measured confidential workload and lets a lender submit narrow `CHECK`, `PLEDGE`, and `RELEASE` instructions on Coston2 without receiving the invoice book.

## Users and authority

| Role | Capabilities | Authority boundary |
| --- | --- | --- |
| Visitor | Read the marketing page | None |
| Borrower with a Coston2 wallet | Seal an invoice and view borrower invoice records | Wallet signature authorizes invoice creation |
| Lender with a Coston2 wallet | View commitment-only handles and submit protocol instructions | Wallet transaction and contracts authorize actions |
| Public observer | View recorded transaction history | Coston2 is the source of transaction truth |

The TEE and Coston2 registries decide confidential protocol state. PostgreSQL stores application records only.

## Route and permission matrix

| Route | Purpose | Allowed state | Data and actions | Failure behavior |
| --- | --- | --- | --- | --- |
| `/` | Public product explanation | Everyone | Public content and wallet entry point | Static error page |
| `/borrower` | Borrower desk | Public read; connected Coston2 wallet required to create | Full borrower records; seal invoice | Disable creation until wallet/network is ready |
| `/lender` | Lender desk | Public read; connected Coston2 wallet required for transactions | Commitments only; check, pledge, release | Never reveal invoice terms; report wallet/chain errors |
| `/activity` | Audit history | Everyone | Verified submitted transaction records | Explicit loading, empty, and retry states |
| `/api/health` | Deployment health | Everyone | Database and TEE configuration status | `503` when database is unavailable |
| `/api/tee/info` | TEE encryption identity | Everyone | Public TEE key and measurement | `502/503`; no fallback identity |
| `/api/invoices` | Borrower records and creation | Read is public for this testnet demo; writes require a valid borrower signature | Store only after TEE sealing succeeds | Reject malformed, unsigned, or undelivered records |
| `/api/lender/invoices[/id]` | Confidential lender handles | Everyone | Commitment and undisclosed placeholders only | `404` for unknown records |
| `/api/activity` | Audit records | Everyone | Latest verified activity | Database error response |
| `/api/activity/transactions` | Record wallet actions | Successful matching Coston2 transaction required | Verify destination, calldata, and receipt before storage | Reject mismatched or failed transactions |

## Application structure

- One Next.js App Router deployment.
- Next.js route handlers provide the server-only API boundary.
- Prisma connects route handlers to Neon PostgreSQL.
- Browser code never receives `DATABASE_URL` or `DIRECT_API_KEY`.
- No separate Fastify service, CORS layer, or second Vercel project.

## Required flows

1. Borrower connects a wallet on Coston2.
2. Browser derives the commitment, encrypts invoice fields to the TEE public key, and signs the canonical authorization message.
3. `/api/invoices` verifies the signature, sends ciphertext to authenticated TEE `/direct`, then stores the application record.
4. Lender receives only a commitment and submits a Coston2 contract transaction.
5. `/api/activity/transactions` verifies the successful transaction before recording it.

## Interface system

Use the existing Cleat token-based component system, responsive desk shell, real semantic controls, visible focus states, and explicit loading, empty, error, and success states. Do not add decorative gradients or expose internal deployment jargon to users.

## No-fake rules

- No seeded invoices or fabricated protocol outcomes.
- No fallback TEE key, transaction hash, wallet, commitment, or success state.
- A failed TEE delivery must not create an invoice record.
- A transaction must be verified against Coston2 before it appears in activity.

## Acceptance criteria

- One `web` deployment serves the UI and `/api/*`.
- `backend/` and Fastify are absent.
- Same-origin browser requests require no CORS configuration.
- Prisma migrations remain reproducible.
- Production build, lint, API checks, Go tests, and Solidity tests pass.
