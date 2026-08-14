import type { ComponentType } from "react";
import {
  AgingMockup,
  CheckMockup,
  LimitsMockup,
  ResultMockup,
} from "@/components/landing/mockups";
import { PhotoStage } from "@/components/landing/photo-stage";
import { SectionShell } from "@/components/landing/chrome";

const blocks: {
  eyebrow: string;
  title: string;
  body: string;
  src: string;
  Mock: ComponentType;
}[] = [
  {
    eyebrow: "The file",
    title: "You already sent the aging report",
    body: "Customers, terms, who pays late. You wanted a facility. They got the file.",
    src: "/landing/ocean.jpg",
    Mock: AgingMockup,
  },
  {
    eyebrow: "Selective disclosure",
    title: "Disclose the answer, not the receivable",
    body: "The check returns one result. The lender does not see the customer, the amount, or any other invoice.",
    src: "/landing/harbor.jpg",
    Mock: CheckMockup,
  },
  {
    eyebrow: "The answer",
    title: "Already pledged, or clear to fund",
    body: "Then they fund, or they don't. The explorer shows a commitment. Not the customer. Not the amount.",
    src: "/landing/forest.jpg",
    Mock: ResultMockup,
  },
  {
    eyebrow: "Limits",
    title: "It will not file anything for you",
    body: "Not a legal assignment. Not proof the invoice is real. Only whether it's already pledged here.",
    src: "/landing/hero.jpg",
    Mock: LimitsMockup,
  },
];

export function LandingFeatures() {
  return (
    <SectionShell id="features">
      <div className="landing-stack">
        {blocks.map((block, index) => (
          <article
            className="landing-stack-card"
            key={block.eyebrow}
            style={{ top: `calc(4.75rem + ${index * 14}px)`, zIndex: index + 1 }}
          >
            <div className="grid grid-cols-1 items-center gap-8 p-6 sm:gap-10 sm:p-8 xl:grid-cols-2 xl:gap-12 xl:p-10">
              <div className="space-y-5">
                <p className="landing-mono text-sm tracking-[0.5px] text-[var(--landing-muted-fg)]">
                  {String(index + 1).padStart(2, "0")} · {block.eyebrow}
                </p>
                <h3 className="text-balance text-2xl font-medium tracking-[-0.5px] sm:text-3xl lg:text-4xl">
                  {block.title}
                </h3>
                <p className="max-w-[500px] text-pretty text-base leading-relaxed text-[var(--landing-muted-fg)] sm:text-lg">
                  {block.body}
                </p>
              </div>
              <PhotoStage src={block.src}>
                <block.Mock />
              </PhotoStage>
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
