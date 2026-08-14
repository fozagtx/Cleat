"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { DeskCard, DeskSkeleton } from "@/components/desk-card";
import { primaryBtn, secondaryBtn } from "@/components/landing/chrome";
import {
  fetchLenderInvoices,
  recordProtocolTransaction,
  type LenderInvoice,
} from "@/lib/api";
import {
  instructionFee,
  instructionSenderAbi,
  instructionSenderAddress,
} from "@/lib/contracts";
import { explorerTx, shortHash } from "@/lib/format";
import { coston2 } from "@/lib/wagmi";

const functionNames = {
  check: "sendCheck",
  pledge: "sendPledge",
  release: "sendRelease",
} as const;

const DEMO_HANDLES = ["INV-441", "INV-882"] as const;

function transactionError(error: unknown) {
  if (!(error instanceof Error)) return "Transaction failed.";
  const short =
    "shortMessage" in error && typeof error.shortMessage === "string"
      ? error.shortMessage
      : error.message.split("\n")[0];
  if (short.toLowerCase().includes("rejected")) return "Request cancelled.";
  if (short.toLowerCase().includes("execution reverted")) {
    return "The FCC machine is not active yet. Try again after TEE promotion.";
  }
  return short;
}

export function LenderDesk() {
  const [invoices, setInvoices] = useState<LenderInvoice[] | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState<Command | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: coston2.id });
  const { writeContractAsync } = useWriteContract();

  function load() {
    setError(null);
    setInvoices(null);
    fetchLenderInvoices()
      .then((rows) => {
        setInvoices(rows);
        setSelected((current) => {
          if (current && rows.some((row) => row.id === current)) return current;
          return rows.find((row) => row.invoiceNumber === "INV-441")?.id || rows[0]?.id || "";
        });
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Could not load invoice handles"),
      );
  }

  useEffect(() => {
    load();
  }, []);

  const invoice = invoices?.find((row) => row.id === selected) ?? invoices?.[0];
  const walletReady = isConnected && chainId === coston2.id && Boolean(address);

  function selectHandle(invoiceNumber: string) {
    const match = invoices?.find((row) => row.invoiceNumber === invoiceNumber);
    if (!match) {
      setError(`${invoiceNumber} is not sealed yet.`);
      return;
    }
    setSelected(match.id);
    setError(null);
    setMessage(`Selected ${invoiceNumber}.`);
    setTxHash(null);
  }

  async function run(command: Command) {
    if (!invoice || !walletReady || !publicClient) return;
    setBusy(command);
    setMessage("Confirm the instruction in your wallet.");
    setError(null);
    setTxHash(null);
    try {
      const hash = await writeContractAsync({
        abi: instructionSenderAbi,
        address: instructionSenderAddress,
        args: [invoice.commitment],
        chainId: coston2.id,
        functionName: functionNames[command],
        value: instructionFee,
      });
      setTxHash(hash);
      setMessage("Submitted. Waiting for Coston2 confirmation.");
      await publicClient.waitForTransactionReceipt({ hash });
      await recordProtocolTransaction(command, invoice.commitment, hash);
      setMessage("Confirmed on Coston2. FCC will publish the confidential result.");
    } catch (reason) {
      setMessage(null);
      setError(transactionError(reason));
    } finally {
      setBusy(null);
    }
  }

  if (!invoices && !error) {
    return <DeskSkeleton />;
  }

  if (error && !invoices) {
    return (
      <DeskCard
        description={error}
        footer={
          <button className={secondaryBtn} onClick={load} type="button">
            Try again
          </button>
        }
        title="Could not load invoice handles"
      />
    );
  }

  if (!invoices?.length) {
    return (
      <DeskCard
        description="A borrower must create a confidential commitment before a lender can review it."
        title="No invoice handles yet"
      />
    );
  }

  return (
    <DeskCard
      description="Choose a sealed invoice handle, then submit a live Coston2 instruction."
      footer={
        <>
          <button
            aria-busy={busy === "check"}
            className={primaryBtn}
            disabled={!invoice || !walletReady || Boolean(busy)}
            onClick={() => run("check")}
            type="button"
          >
            {busy === "check" ? "Submitting…" : "Check commitment"}
          </button>
          <button
            aria-busy={busy === "pledge"}
            className={secondaryBtn}
            disabled={!invoice || !walletReady || Boolean(busy)}
            onClick={() => run("pledge")}
            type="button"
          >
            {busy === "pledge" ? "Submitting…" : "Pledge commitment"}
          </button>
          <button
            aria-busy={busy === "release"}
            className={secondaryBtn}
            disabled={!invoice || !walletReady || Boolean(busy)}
            onClick={() => run("release")}
            type="button"
          >
            {busy === "release" ? "Submitting…" : "Release pledge"}
          </button>
        </>
      }
      title="Confidential review"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div>
          <label className="mb-3 block" htmlFor="lender-invoice">
            <span className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">
              Sealed invoice
            </span>
            <select
              className="desk-select mt-2"
              id="lender-invoice"
              onChange={(event) => {
                setSelected(event.target.value);
                setMessage(null);
                setError(null);
                setTxHash(null);
              }}
              value={selected}
            >
              {invoices.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.invoiceNumber} · {shortHash(row.commitment)}
                </option>
              ))}
            </select>
          </label>
          <div className="mb-5 flex flex-wrap gap-2">
            {DEMO_HANDLES.map((invoiceNumber) => (
              <button
                className={secondaryBtn}
                disabled={Boolean(busy)}
                key={invoiceNumber}
                onClick={() => selectHandle(invoiceNumber)}
                type="button"
              >
                Select {invoiceNumber}
              </button>
            ))}
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[var(--landing-border)] pb-3">
              <dt className="text-[var(--landing-muted-fg)]">Commitment</dt>
              <dd className="landing-mono tabular-nums">{shortHash(invoice?.commitment ?? null)}</dd>
            </div>
            {["Invoice", "Customer", "Face value", "Due date"].map((field) => (
              <div
                className="flex justify-between gap-4 border-b border-[var(--landing-border)] pb-3 last:border-0"
                key={field}
              >
                <dt className="text-[var(--landing-muted-fg)]">{field}</dt>
                <dd>Not disclosed</dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          aria-live="polite"
          className="flex min-h-48 flex-col justify-between rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg)] p-5"
        >
          <p className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">Network status</p>
          <div className="mt-8">
            {!isConnected ? (
              <p className="text-xl font-medium tracking-[-0.5px]">Connect your wallet to continue.</p>
            ) : chainId !== coston2.id ? (
              <p className="text-xl font-medium tracking-[-0.5px]">Switch your wallet to Coston2.</p>
            ) : (
              <p className="text-xl font-medium tracking-[-0.5px]">
                {message ?? "Ready for a live instruction."}
              </p>
            )}
            {error ? <p className="mt-3 text-sm text-[var(--landing-danger)]">{error}</p> : null}
            {txHash ? (
              <a
                className="desk-link landing-mono mt-4 inline-flex min-h-10 items-center text-sm"
                href={explorerTx(txHash)}
                rel="noreferrer"
                target="_blank"
              >
                View {shortHash(txHash)}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </DeskCard>
  );
}
