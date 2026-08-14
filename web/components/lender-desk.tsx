"use client";

import { useEffect, useState } from "react";
import { DeskCard } from "@/components/desk-card";
import { primaryBtn, secondaryBtn } from "@/components/landing/chrome";
import { fetchInvoices, runProtocol, type Invoice } from "@/lib/api";
import { formatDateUtc, formatFiatMinor } from "@/lib/format";

export function LenderDesk() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<string>("inv-001");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices()
      .then((rows) => {
        setInvoices(rows);
        if (rows[0]) setSelected(rows[0].id);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  }, []);

  const invoice = invoices.find((row) => row.id === selected) ?? invoices[0];

  async function run(command: string) {
    if (!invoice) return;
    setBusy(command);
    setMessage(null);
    setError(null);
    try {
      const res = await runProtocol(command, invoice.id);
      setMessage(res.error ?? `Asked the network to ${command}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DeskCard
      description="Choose one invoice, check it, then pledge it."
      footer={
        <>
          <button className={primaryBtn} disabled={!invoice || Boolean(busy)} onClick={() => run("check")} type="button">
            {busy === "check" ? "Checking…" : "Check this invoice"}
          </button>
          <button
            className={secondaryBtn}
            disabled={!invoice || Boolean(busy)}
            onClick={() => run("pledge")}
            type="button"
          >
            {busy === "pledge" ? "Pledging…" : "Pledge it"}
          </button>
        </>
      }
      title="Invoice review"
    >
      {!invoice ? (
        <p className="text-sm text-[var(--landing-muted-fg)]">No invoice loaded.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div>
            {invoices.length > 1 ? (
              <label className="mb-5 block">
                <span className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">Invoice</span>
                <select
                  className="desk-select mt-2"
                  onChange={(event) => {
                    setSelected(event.target.value);
                    setMessage(null);
                    setError(null);
                  }}
                  value={selected}
                >
                  {invoices.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.invoiceNumber} · {row.debtorName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-[var(--landing-border)] pb-3">
                <dt className="text-[var(--landing-muted-fg)]">Invoice</dt>
                <dd className="landing-mono tabular-nums">{invoice.invoiceNumber}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--landing-border)] pb-3">
                <dt className="text-[var(--landing-muted-fg)]">Customer</dt>
                <dd>{invoice.debtorName}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--landing-border)] pb-3">
                <dt className="text-[var(--landing-muted-fg)]">Due</dt>
                <dd className="landing-mono tabular-nums">{formatDateUtc(invoice.dueDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--landing-muted-fg)]">Face</dt>
                <dd className="landing-mono tabular-nums">{formatFiatMinor(invoice.amountMinor, invoice.currency)}</dd>
              </div>
            </dl>
          </div>

          <div
            aria-live="polite"
            className="flex min-h-48 flex-col justify-between rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg)] p-5"
          >
            <p className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">Answer</p>
            <div className="mt-8">
              {message ? (
                <p className="text-xl font-medium tracking-[-0.5px]">{message}</p>
              ) : (
                <p className="text-xl font-medium tracking-[-0.5px] text-[var(--landing-muted-fg)]">Not checked yet</p>
              )}
              {error ? <p className="mt-3 text-sm text-[var(--landing-danger)]">{error}</p> : null}
            </div>
          </div>
        </div>
      )}
    </DeskCard>
  );
}
