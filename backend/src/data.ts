export type Invoice = {
  id: string;
  invoiceNumber: string;
  debtorName: string;
  currency: string;
  amountMinor: string;
  dueDate: string;
};

export type LenderView = {
  commitment: string;
  disclosed: {
    invoiceNumber: "NOT DISCLOSED";
    debtorName: "NOT DISCLOSED";
    amount: "NOT DISCLOSED";
  };
  termsShown: {
    currency: string;
    amountMinor: string;
    dueDate: string;
  } | null;
  protocol: {
    eligible: boolean | null;
    reason: string | null;
    status: string | null;
    requestId: string | null;
    txHash: string | null;
  };
};

export type AuditRow = {
  id: string;
  at: string;
  event: string;
  result: string;
  commitment: string | null;
  txHash: string | null;
};

export const seedInvoices: Invoice[] = [
  {
    id: "inv-001",
    invoiceNumber: "INV-001",
    debtorName: "ACME",
    currency: "USD",
    amountMinor: "10000000",
    dueDate: "2026-09-15T00:00:00.000Z",
  },
  {
    id: "inv-002",
    invoiceNumber: "INV-002",
    debtorName: "Northwind",
    currency: "USD",
    amountMinor: "4200000",
    dueDate: "2026-10-01T00:00:00.000Z",
  },
];
