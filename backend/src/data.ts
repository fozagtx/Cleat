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
