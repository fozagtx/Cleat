"use client";

import { useState, type FormEvent } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createInvoice, fetchTeeInfo } from "@/lib/api";
import { primaryBtn } from "@/components/landing/chrome";
import { invoiceAuthorizationMessage, sealInvoice } from "@/lib/seal";
import { coston2 } from "@/lib/wagmi";

type Props = {
  onCreated: () => void;
};

const fieldClass = "desk-select mt-2";

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
  const walletReady = isConnected && chainId === coston2.id && Boolean(address);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address || !walletReady) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const draft = {
        amountMinor: fiatToMinor(String(form.get("amount") ?? "")),
        currency: String(form.get("currency") ?? ""),
        debtorName: String(form.get("debtorName") ?? ""),
        dueDate: String(form.get("dueDate") ?? ""),
        invoiceNumber: String(form.get("invoiceNumber") ?? ""),
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
          The browser encrypts the invoice to the measured TEE before delivery. Lenders receive only its commitment.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block" htmlFor="invoice-number">
          <span className="text-sm">Invoice number</span>
          <input
            autoComplete="off"
            className={fieldClass}
            id="invoice-number"
            name="invoiceNumber"
            required
            type="text"
          />
        </label>
        <label className="block" htmlFor="debtor-name">
          <span className="text-sm">Customer</span>
          <input
            autoComplete="organization"
            className={fieldClass}
            id="debtor-name"
            name="debtorName"
            required
            type="text"
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
            placeholder="100000.00"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="block" htmlFor="invoice-currency">
          <span className="text-sm">Currency</span>
          <select className={fieldClass} defaultValue="USD" id="invoice-currency" name="currency">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
        <label className="block md:col-span-2" htmlFor="invoice-due-date">
          <span className="text-sm">Due date</span>
          <input className={fieldClass} id="invoice-due-date" name="dueDate" required type="date" />
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

      <button
        aria-busy={busy}
        className={`${primaryBtn} mt-6`}
        disabled={!walletReady || busy}
        type="submit"
      >
        {busy ? "Encrypting and sealing…" : "Seal invoice"}
      </button>
    </form>
  );
}
