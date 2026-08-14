import { SectionShell } from "@/components/landing/chrome";

export function HowItWorks() {
  return (
    <SectionShell className="pt-10 sm:pt-14" id="how">
      <div className="mb-8 max-w-2xl sm:mb-10">
        <p className="landing-mono text-sm tracking-[0.5px] text-[var(--landing-muted-fg)]">
          How it works
        </p>
        <h2 className="mt-3 text-3xl font-medium tracking-[-0.5px] sm:text-4xl">
          One invoice. One answer.
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <article className="how-card lg:col-span-5">
          <div>
            <p className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">
              01 · Select
            </p>
            <h3 className="mt-3 text-2xl font-medium tracking-[-0.5px]">Pick the invoice</h3>
            <p className="mt-2 text-[var(--landing-muted-fg)]">Not the whole aging report.</p>
          </div>
          <div aria-hidden="true" className="how-invoice-list">
            <div className="how-selector" />
            <div className="how-invoice-row">
              <span className="landing-mono">INV-001</span>
              <span>ACME</span>
              <span className="landing-mono text-right">$100,000</span>
            </div>
            <div className="how-invoice-row">
              <span className="landing-mono">INV-002</span>
              <span>Northwind</span>
              <span className="landing-mono text-right">$42,000</span>
            </div>
          </div>
        </article>

        <article className="how-card lg:col-span-7">
          <div>
            <p className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">
              02 · Check
            </p>
            <h3 className="mt-3 text-2xl font-medium tracking-[-0.5px]">Check it confidentially</h3>
            <p className="mt-2 text-[var(--landing-muted-fg)]">The customer and amount stay sealed.</p>
          </div>
          <div aria-hidden="true" className="how-seal">
            <div className="how-seal-source">
              <span>ACME</span>
              <span className="landing-mono">$100,000</span>
            </div>
            <div className="how-seal-track">
              <span className="how-packet how-packet-one" />
              <span className="how-packet how-packet-two" />
              <span className="how-packet how-packet-three" />
            </div>
            <div className="how-seal-target">
              <span className="landing-mono text-[10px] tracking-[0.5px] text-[var(--preview-muted)]">
                CONFIDENTIAL CHECK
              </span>
              <span className="mt-2 block text-sm">Sealed</span>
            </div>
          </div>
        </article>

        <article className="how-card how-result-card lg:col-span-12">
          <div>
            <p className="landing-mono text-xs tracking-[0.5px] text-[var(--landing-muted-fg)]">
              03 · Answer
            </p>
            <h3 className="mt-3 text-2xl font-medium tracking-[-0.5px]">
              Already pledged, or clear to fund
            </h3>
            <p className="mt-2 text-[var(--landing-muted-fg)]">Only the eligibility result is disclosed.</p>
          </div>
          <div aria-hidden="true" className="how-answer">
            <div className="how-answer-status">
              <span className="how-answer-checking">Checking…</span>
              <span className="how-answer-clear">Clear to fund</span>
            </div>
            <div className="how-answer-meta">
              <span>Explorer</span>
              <span className="landing-mono">0x71c4…9a20</span>
            </div>
          </div>
        </article>
      </div>
    </SectionShell>
  );
}
