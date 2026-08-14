CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "debtorName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_commitments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "encryptedBlob" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_commitments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financing_requests" (
    "id" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "financier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financing_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financings" (
    "id" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "financier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "financings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tee_results" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eligible" BOOLEAN,
    "reason" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tee_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "commitment" TEXT,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_address_key" ON "User"("address");
CREATE UNIQUE INDEX "invoices_borrowerId_invoiceNumber_key" ON "invoices"("borrowerId", "invoiceNumber");
CREATE UNIQUE INDEX "invoice_commitments_commitment_key" ON "invoice_commitments"("commitment");
CREATE UNIQUE INDEX "verification_requests_requestId_key" ON "verification_requests"("requestId");

ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_borrowerId_fkey"
FOREIGN KEY ("borrowerId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_commitments"
ADD CONSTRAINT "invoice_commitments_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
