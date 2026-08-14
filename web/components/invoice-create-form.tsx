"use client";

import { useState, type FormEvent } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createInvoice, fetchTeeInfo } from "@/lib/api";
import { primaryBtn, secondaryBtn } from "@/components/landing/chrome";
import { invoiceAuthorizationMessage, sealInvoice } from "@/lib/seal";
import { coston2 } from "@/lib/wagmi";

type Props = {
  onCreated: () => void;
};

const fieldClass = "desk-select mt-2";

const DEMO_INVOICES = [
  {
    amount: "42000.00",
    currency: "USD",
    debtorName: "Northwind Trading",
    dueDate: "2026-12-15",
    invoiceNumber: "INV-441",
    label: "Northwind $42,000",
  },
  {
    amount: "185000.00",
    currency: "EUR",
    debtorName: "Harbor Goods",
    dueDate: "2026-11-01",
    invoiceNumber: "INV-882",
    label: "Harbor €185,000",
  },
] as const;

function fiatToMinor(value: string) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Enter an amount with no more than two decimals.");
  return `${match[1]}${(match[2] ?? "").padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
}

export function InvoiceCreateForm({ onCreated }: Props) {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [debtorName, setDebtorName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dueDate, setDueDate] = useState("");
  const walletReady = isConnected && chainId === coston2.id && Boolean(address);

  function fillDemo(index: number) {
    const demo = DEMO_INVOICES[index];
    setInvoiceNumber(demo.invoiceNumber);
    setDebtorName(demo.debtorName);
    setAmount(demo.amount);
    setCurrency(demo.currency);
    setDueDate(demo.dueDate);
    setError(null);
    setSuccess(`Loaded ${demo.label}.`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address || !walletReady) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const formElement = event.currentTarget;
    try {
      const draft = {
        amountMinor: fiatToMinor(amount),
        currency,
        debtorName,
        dueDate,
        invoiceNumber,
      };
      const tee = await fetchTeeInfo();
      const sealed = await sealInvoice(draft, tee);
      const signature = await signMessageAsync({
        message: invoiceAuthorizationMessage(sealed.authorization),
      });
      await createInvoice({
        address,
        signature,
        ...sealed.authorization,
      });
      formElement.reset();
      setInvoiceNumber("");
      setDebtorName("");
      setAmount("");
      setCurrency("USD");
      setDueDate("");
      setSuccess(`Sealed ${sealed.commitment.slice(0, 10)}… inside the TEE.`);
      onCreated();
    } catch (reason) {
      const message =
        reason instanceof Error && reason.message.toLowerCase().includes("rejected")
          ? "Signature cancelled."
          : reason instanceof Error
            ? reason.message
            : "Could not seal invoice.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="desk-card p-6" onSubmit={submit}>
      <div className="mb-6">
        <p className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">New receivable</p>
        <h2 className="mt-2 text-xl font-medium tracking-[-0.5px]">Seal an invoice</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--landing-muted-fg)]">
          Fill a demo invoice, then press Seal invoice.
        </p>
        <p className="mt-5 text-sm font-medium">1. Fill a demo invoice</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMO_INVOICES.map((demo, index) => (
            <button
              className={secondaryBtn}
              disabled={busy}
              key={demo.invoiceNumber}
              onClick={() => fillDemo(index)}
              type="button"
            >
              Fill {demo.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block" htmlFor="invoice-number">
          <span className="text-sm">Invoice number</span>
          <input
            autoComplete="off"
            className={fieldClass}
            id="invoice-number"
            name="invoiceNumber"
            onChange={(event) => setInvoiceNumber(event.target.value)}
            required
            type="text"
            value={invoiceNumber}
          />
        </label>
        <label className="block" htmlFor="debtor-name">
          <span className="text-sm">Customer</span>
          <input
            autoComplete="organization"
            className={fieldClass}
            id="debtor-name"
            name="debtorName"
            onChange={(event) => setDebtorName(event.target.value)}
            required
            type="text"
            value={debtorName}
          />
        </label>
        <label className="block" htmlFor="invoice-amount">
          <span className="text-sm">Face value</span>
          <input
            autoComplete="off"
            className={`${fieldClass} landing-mono tabular-nums`}
            id="invoice-amount"
            inputMode="decimal"
            min="0.01"
            name="amount"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="100000.00"
            required
            step="0.01"
            type="number"
            value={amount}
          />
        </label>
        <label className="block" htmlFor="invoice-currency">
          <span className="text-sm">Currency</span>
          <select
            className={fieldClass}
            id="invoice-currency"
            name="currency"
            onChange={(event) => setCurrency(event.target.value)}
            value={currency}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
        <label className="block md:col-span-2" htmlFor="invoice-due-date">
          <span className="text-sm">Due date</span>
          <input
            className={fieldClass}
            id="invoice-due-date"
            name="dueDate"
            onChange={(event) => setDueDate(event.target.value)}
            required
            type="date"
            value={dueDate}
          />
        </label>
      </div>

      <div aria-live="polite" className="mt-6">
        {!walletReady ? (
          <p className="text-sm text-[var(--landing-muted-fg)]">
            {isConnected ? "Switch your wallet to Coston2." : "Connect your wallet to seal an invoice."}
          </p>
        ) : null}
        {error ? <p className="text-sm text-[var(--landing-danger)]">{error}</p> : null}
        {success ? <p className="text-sm">{success}</p> : null}
      </div>

      <p className="mt-8 text-sm font-medium">2. Seal invoice</p>
      <button
        aria-busy={busy}
        className={`${primaryBtn} mt-2`}
        disabled={!walletReady || busy}
        type="submit"
      >
        {busy ? "Encrypting and sealing…" : "Seal invoice"}
      </button>
    </form>
  );
}
