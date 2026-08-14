"use client";

import { useEffect, useState } from "react";
import { MockupShell } from "@/components/landing/photo-stage";

export function AgingMockup() {
  const rows = [
    ["INV-001", "ACME", "$100,000"],
    ["INV-002", "Northwind", "$42,000"],
  ];
  return (
    <MockupShell title="aging-report.xlsx">
      <div className="p-3">
        <p className="mb-3 text-xs font-medium">Open invoices</p>
        <div className="overflow-hidden rounded-[8px] border border-[var(--preview-border)]">
          {rows.map((row, index) => (
            <div
              key={row[0]}
              className="grid grid-cols-[72px_1fr_88px] gap-2 border-b border-[var(--preview-divider)] px-3 py-2 text-[11px] last:border-b-0"
              style={{ background: index === 0 ? "var(--landing-highlight)" : undefined }}
            >
              <span className="landing-mono text-[var(--preview-muted)]">{row[0]}</span>
              <span>{row[1]}</span>
              <span className="landing-mono text-right">{row[2]}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[var(--preview-muted)]">The file you send to fund one invoice.</p>
      </div>
    </MockupShell>
  );
}

const checkFrames = [
  { status: "Sealed", detail: "The book stays private.", tone: "muted" },
  { status: "Checking…", detail: "Checking this invoice.", tone: "brand" },
  { status: "Clear to fund", detail: "Not already pledged here.", tone: "ok" },
] as const;

export function CheckMockup({ wide = false }: { wide?: boolean }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFrame(2);
      return;
    }
    const id = window.setInterval(() => setFrame((value) => (value + 1) % checkFrames.length), 1800);
    return () => window.clearInterval(id);
  }, []);

  const current = checkFrames[frame] ?? checkFrames[0];

  return (
    <MockupShell title="cleat / review" wide={wide}>
      <div className="grid gap-px bg-[var(--preview-divider)] sm:grid-cols-2">
        <div className="bg-[var(--preview-card)] p-4">
          <p className="landing-mono text-[10px] tracking-[0.5px] text-[var(--preview-muted)]">INVOICE</p>
          <p className="landing-mono mt-2 text-sm">INV-001</p>
          <dl className="mt-4 space-y-2 text-[11px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--preview-muted)]">Customer</dt>
              <dd className="blur-[5px] select-none">ACME</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--preview-muted)]">Face</dt>
              <dd className="landing-mono blur-[5px] select-none">$100,000</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--preview-muted)]">Due</dt>
              <dd className="landing-mono blur-[5px] select-none">15 Sep 2026</dd>
            </div>
          </dl>
        </div>
        <div className="bg-[var(--preview-sidebar)] p-4">
          <p className="landing-mono text-[10px] tracking-[0.5px] text-[var(--preview-muted)]">RESULT</p>
          <p
            className={`mt-2 text-sm font-medium ${
              current.tone === "brand"
                ? "text-[var(--preview-accent)]"
                : current.tone === "ok"
                  ? "text-[var(--preview-fg)]"
                  : "text-[var(--preview-muted)]"
            }`}
          >
            {current.status}
          </p>
          <p className="mt-3 max-w-[220px] text-[11px] leading-relaxed text-[var(--preview-muted)]">{current.detail}</p>
        </div>
      </div>
    </MockupShell>
  );
}

export function ResultMockup() {
  return (
    <MockupShell title="cleat / answer">
      <div className="p-5">
        <p className="landing-mono text-[10px] tracking-[0.5px] text-[var(--preview-muted)]">WHAT YOU GET BACK</p>
        <p className="mt-3 text-2xl font-medium tracking-[-0.5px]">Clear to fund</p>
        <div className="mt-5 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-[8px] border border-[var(--preview-border)] p-3">
            <p className="text-[var(--preview-muted)]">Explorer</p>
            <p className="mt-1">Commitment only</p>
          </div>
          <div className="rounded-[8px] border border-[var(--preview-border)] p-3">
            <p className="text-[var(--preview-muted)]">Book</p>
            <p className="mt-1">Stays private</p>
          </div>
        </div>
      </div>
    </MockupShell>
  );
}

export function LimitsMockup() {
  const rows = [
    ["Legal assignment", "No"],
    ["Proof the invoice is real", "No"],
    ["Names on the explorer", "No"],
    ["Amounts on the explorer", "No"],
    ["Already pledged here", "Yes"],
  ];
  return (
    <MockupShell title="cleat / limits">
      <div className="p-4">
        <p className="mb-3 text-xs font-medium">What this check will not do</p>
        <div className="overflow-hidden rounded-[8px] border border-[var(--preview-border)]">
          {rows.map((row) => (
            <div
              key={row[0]}
              className="flex items-center justify-between border-b border-[var(--preview-divider)] px-3 py-2.5 text-[12px] last:border-b-0"
            >
              <span>{row[0]}</span>
              <span className={`landing-mono ${row[1] === "Yes" ? "text-[var(--preview-accent)]" : "text-[var(--preview-muted)]"}`}>
                {row[1]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </MockupShell>
  );
}
