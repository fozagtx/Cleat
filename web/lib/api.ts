export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

export async function runProtocol(command: string, invoiceId: string, attack?: string) {
  const res = await fetch(`${API_URL}/protocol/${command}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoiceId, attack }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  return { http: res.status, ...data };
}
