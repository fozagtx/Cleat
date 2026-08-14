const API_URL = "/api";

export type Invoice = {
  id: string;
  invoiceNumber: string;
  debtorName: string;
  currency: string;
  amountMinor: string;
  dueDate: string;
};

export type ProtocolResult = {
  eligible: boolean | null;
  reason: string | null;
  status: string | null;
  requestId: string | null;
  txHash: string | null;
};

export type LenderInvoice = {
  id: string;
  commitment: `0x${string}`;
};

export type TeeInfo = {
  codeHash?: `0x${string}`;
  platform?: `0x${string}`;
  publicKey: {
    x: `0x${string}`;
    y: `0x${string}`;
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

export async function fetchInvoices(): Promise<Invoice[]> {
  const res = await fetch(`${API_URL}/invoices`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load invoices");
  const data = (await res.json()) as { invoices: Invoice[] };
  return data.invoices;
}

export async function fetchActivity(): Promise<AuditRow[]> {
  const res = await fetch(`${API_URL}/activity`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load history");
  const data = (await res.json()) as { activity: AuditRow[] };
  return data.activity;
}

export async function fetchLenderInvoices(): Promise<LenderInvoice[]> {
  const res = await fetch(`${API_URL}/lender/invoices`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load confidential invoice handles");
  const data = (await res.json()) as { invoices: LenderInvoice[] };
  return data.invoices;
}

export async function fetchTeeInfo(): Promise<TeeInfo> {
  const res = await fetch(`${API_URL}/tee/info`, { cache: "no-store" });
  const data = (await res.json()) as TeeInfo & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Could not load TEE identity");
  return data;
}

export async function createInvoice(input: {
  address: string;
  amountMinor: string;
  commitment: `0x${string}`;
  currency: string;
  debtorName: string;
  dueDate: string;
  encryptedBlob: `0x${string}`;
  invoiceNumber: string;
  signature: `0x${string}`;
}) {
  const res = await fetch(`${API_URL}/invoices`, {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const data = (await res.json()) as { error?: string; id?: string; ok?: boolean };
  if (!res.ok) throw new Error(data.error ?? "Could not seal invoice");
  return data;
}

export async function recordProtocolTransaction(
  command: string,
  commitment: `0x${string}`,
  txHash: `0x${string}`,
) {
  const res = await fetch(`${API_URL}/activity/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command, commitment, txHash }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Could not verify transaction");
  return data;
}
