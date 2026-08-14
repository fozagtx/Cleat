"use client";

import { useEffect, useState } from "react";
import { DeskCard, DeskSkeleton } from "@/components/desk-card";
import { ghostBtn } from "@/components/landing/chrome";
import { fetchInvoices, type Invoice } from "@/lib/api";
import { formatDateUtc, formatFiatMinor } from "@/lib/format";

export function InvoiceTable() {
  const [rows, setRows] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setRows(null);
    fetchInvoices()
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  }

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return (
      <DeskCard
        description={`${error}. Start the API on port 3001.`}
        footer={
          <button className={ghostBtn} onClick={load} type="button">
            Try again
          </button>
        }
        title="Could not load invoices"
      />
    );
  }
  if (!rows) {
    return <DeskSkeleton />;
  }
  if (rows.length === 0) {
    return <DeskCard description="Nothing to pledge." title="No invoices yet" />;
  }

  return (
    <div className="desk-card overflow-x-auto">
      <table className="desk-table">
        <thead>
          <tr>
            <th scope="col">Invoice</th>
            <th scope="col">Customer</th>
            <th scope="col">Due</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th className="landing-mono tabular-nums" scope="row">
                {row.invoiceNumber}
              </th>
              <td>{row.debtorName}</td>
              <td className="landing-mono tabular-nums">{formatDateUtc(row.dueDate)}</td>
              <td className="landing-mono tabular-nums">{formatFiatMinor(row.amountMinor, row.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
