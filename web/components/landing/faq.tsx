"use client";

import { useState } from "react";
import { questions } from "@/lib/landing";
import { SectionShell } from "@/components/landing/chrome";

export function LandingFaq() {
  const [open, setOpen] = useState<string | null>(questions[0]?.title ?? null);

  return (
    <SectionShell id="faq">
      <h2 className="text-3xl font-medium tracking-[-0.5px] sm:text-4xl">Questions</h2>
      <div className="mt-10 border-t border-[var(--landing-border)]">
        {questions.map((item) => {
          const active = open === item.title;
          return (
            <div className="border-b border-[var(--landing-border)]" key={item.title}>
              <button
                aria-expanded={active}
                className="flex min-h-[77px] w-full items-center justify-between gap-6 py-5 text-left text-lg"
                onClick={() => setOpen(active ? null : item.title)}
                type="button"
              >
                <span>{item.title}</span>
                <span className="landing-mono text-xl text-[var(--landing-muted-fg)]">{active ? "×" : "+"}</span>
              </button>
              {active ? (
                <p className="max-w-3xl pb-6 text-base leading-relaxed text-[var(--landing-muted-fg)]">{item.body}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
