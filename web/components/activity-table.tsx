"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { DeskCard, DeskSkeleton } from "@/components/desk-card";
import { ghostBtn, navCta } from "@/components/landing/chrome";
import { fetchActivity, type AuditRow } from "@/lib/api";
import { explorerTx, shortHash } from "@/lib/format";

export function ActivityTable() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(quiet = false) {
    if (!quiet) {
      setError(null);
      setRows(null);
    }
    fetchActivity()
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"));
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(timer);
  }, []);

  if (error && !rows) {
    return (
      <DeskCard
        description={error}
        footer={
          <button className={ghostBtn} onClick={() => load()} type="button">
            Try again
          </button>
        }
        title="Could not load history"
      />
    );
  }
  if (!rows) {
    return <DeskSkeleton rows={4} />;
  }
  if (rows.length === 0) {
    return (
      <DeskCard
        description="Run a check on Review first. History stays empty until that Coston2 instruction lands."
        footer={
          <NextLink className={navCta} href="/lender">
            Go to Review
          </NextLink>
        }
        title="Nothing has run yet"
      />
    );
  }

  return (
    <div className="desk-card overflow-x-auto">
      <table className="desk-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">What</th>
            <th scope="col">Answer</th>
            <th scope="col">Commitment</th>
            <th scope="col">Explorer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="landing-mono whitespace-nowrap tabular-nums">{new Date(row.at).toLocaleString()}</td>
              <td>{row.event}</td>
              <td>{row.result}</td>
              <td className="landing-mono tabular-nums">{shortHash(row.commitment)}</td>
              <td>
                {row.txHash ? (
                  <a className="desk-link landing-mono tabular-nums" href={explorerTx(row.txHash)} rel="noreferrer" target="_blank">
                    {shortHash(row.txHash)}
                  </a>
                ) : (
                  "--"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
