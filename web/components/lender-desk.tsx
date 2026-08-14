"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
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

type Command = "check" | "pledge" | "release";

const functionNames = {
  check: "sendCheck",
  pledge: "sendPledge",
  release: "sendRelease",
} as const;

const STEPS: {
  command: Command;
  title: string;
  first?: boolean;
  hint: string;
}[] = [
  {
    command: "check",
    first: true,
    title: "Check this invoice",
    hint: "Press this first. Asks whether the receivable is already pledged.",
  },
  {
    command: "pledge",
    title: "Pledge this invoice",
    hint: "After a check, lock it so another lender cannot fund it.",
  },
  {
    command: "release",
    title: "Release the pledge",
    hint: "Only if you pledged and will not fund.",
  },
];

function transactionError(error: unknown) {
  if (!(error instanceof Error)) return "Transaction failed.";
  const short =
    "shortMessage" in error && typeof error.shortMessage === "string"
      ? error.shortMessage
      : error.message.split("\n")[0];
  if (short.toLowerCase().includes("rejected")) return "Request cancelled.";
  if (short.toLowerCase().includes("reverted")) {
    return "The instruction reverted. Hard-refresh this page, then press Check this invoice.";
  }
  return short;
}

export function LenderDesk() {
  const [invoices, setInvoices] = useState<LenderInvoice[] | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState<Command | null>(null);
  const [done, setDone] = useState<{ check: boolean; pledge: boolean; release: boolean }>({
    check: false,
    pledge: false,
    release: false,
  });
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

  function resetForInvoice() {
    setError(null);
    setMessage(null);
    setTxHash(null);
    setDone({ check: false, pledge: false, release: false });
  }

  function canRun(command: Command) {
    if (!invoice || !walletReady || Boolean(busy)) return false;
    if (command === "check") return !done.check;
    if (command === "pledge") return done.check && !done.pledge;
    if (command === "release") return done.pledge && !done.release;
    return false;
  }

  async function run(command: Command) {
    if (!canRun(command) || !invoice || !publicClient) return;
    setBusy(command);
    setMessage(`Confirm ${STEPS.find((step) => step.command === command)?.title ?? command} in MetaMask.`);
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
      setMessage("Submitted. Waiting for Coston2.");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("The instruction reverted.");
      }
      if (receipt.to && receipt.to.toLowerCase() !== instructionSenderAddress.toLowerCase()) {
        throw new Error("The instruction reverted.");
      }
      try {
        await recordProtocolTransaction(command, invoice.commitment, hash);
      } catch {
        // Chain already confirmed; History can catch up without failing the desk.
      }
      if (command === "check") {
        setDone({ check: true, pledge: false, release: false });
        setMessage("Check landed. Next: Open History, or Pledge this invoice.");
      } else if (command === "pledge") {
        setDone({ check: true, pledge: true, release: false });
        setMessage("Pledge landed. Open History to see it.");
      } else {
        setDone({ check: true, pledge: true, release: true });
        setMessage("Release landed. Open History to see it.");
      }
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

  const nextCopy = !isConnected
    ? "Connect your wallet first."
    : chainId !== coston2.id
      ? "Switch your wallet to Coston2."
      : busy
        ? message
        : error
          ? null
          : message
            ? message
            : !done.check
              ? "Next: press 2 · Check this invoice."
              : "This instruction is in History. Open History next.";

  return (
    <DeskCard
      description="One path: pick the invoice, check it, then pledge it."
      title="Confidential review"
    >
      <ol className="space-y-6">
        <li className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-5">
          <span className="landing-mono text-sm tabular-nums text-[var(--landing-muted-fg)]">1</span>
          <div>
            <p className="text-sm font-medium">Pick the invoice</p>
            <p className="mt-1 text-sm text-[var(--landing-muted-fg)]">
              INV-441 is selected for the demo. Customer, amount, and due date stay undisclosed.
            </p>
            <label className="mt-3 block" htmlFor="lender-invoice">
              <span className="sr-only">Sealed invoice</span>
              <select
                className="desk-select mt-2"
                id="lender-invoice"
                onChange={(event) => {
                  setSelected(event.target.value);
                  resetForInvoice();
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
            <dl className="mt-4 space-y-3 text-sm">
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
        </li>

        {STEPS.map((step, index) => {
          const n = index + 2;
          const enabled = canRun(step.command);
          const lockedHint =
            step.command === "check" && done.check
              ? "Already checked."
              : step.command === "pledge" && !done.check
                ? "Check first."
                : step.command === "pledge" && done.pledge
                  ? "Already pledged."
                  : step.command === "release" && !done.pledge
                    ? "Pledge first."
                    : step.command === "release" && done.release
                      ? "Already released."
                      : null;
          return (
            <li
              className="grid gap-3 border-t border-[var(--landing-border)] pt-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-5"
              key={step.command}
            >
              <span className="landing-mono text-sm tabular-nums text-[var(--landing-muted-fg)]">{n}</span>
              <div>
                <p className="text-sm font-medium">
                  {step.title}
                  {step.first && !done.check ? (
                    <span className="ml-2 font-normal text-[var(--landing-muted-fg)]">Press this first</span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-[var(--landing-muted-fg)]">{step.hint}</p>
                <button
                  aria-busy={busy === step.command}
                  className={`${step.first ? primaryBtn : secondaryBtn} mt-3`}
                  disabled={!enabled}
                  onClick={() => run(step.command)}
                  type="button"
                >
                  {busy === step.command ? "Submitting…" : step.title}
                </button>
                {lockedHint ? (
                  <p className="mt-2 text-sm text-[var(--landing-muted-fg)]">{lockedHint}</p>
                ) : null}
              </div>
            </li>
          );
        })}

        <li className="grid gap-3 border-t border-[var(--landing-border)] pt-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-5">
          <span className="landing-mono text-sm tabular-nums text-[var(--landing-muted-fg)]">5</span>
          <div>
            <p className="text-sm font-medium">
              Open History
              {done.check ? (
                <span className="ml-2 font-normal text-[var(--landing-muted-fg)]">Go here next</span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-[var(--landing-muted-fg)]">
              After Check, Pledge, or Release lands, it shows up on History with the Coston2 explorer link.
            </p>
            <NextLink
              className={`${done.check ? primaryBtn : secondaryBtn} mt-3 ${done.check ? "" : "pointer-events-none opacity-50"}`}
              href="/activity"
            >
              Open History
            </NextLink>
          </div>
        </li>
      </ol>

      <div
        aria-live="polite"
        className="mt-8 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg)] p-5"
      >
        <p className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">What to do</p>
        {nextCopy ? (
          <p className="mt-3 text-xl font-medium tracking-[-0.5px]">{nextCopy}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-[var(--landing-danger)]">{error}</p> : null}
        {done.check ? (
          <NextLink className={`${primaryBtn} mt-4`} href="/activity">
            Open History
          </NextLink>
        ) : null}
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
    </DeskCard>
  );
}
