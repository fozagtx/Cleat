"use client";

import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { navCta, navLink } from "@/components/landing/chrome";
import { ThemeToggle } from "@/components/landing/theme";
import { WalletReviewButton } from "@/components/wallet-review-button";

const links = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "Questions" },
] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-[var(--landing-border)] bg-[var(--landing-bg)]">
      <div className="px-4 sm:px-8 lg:px-[30px]">
        <div className="mx-auto max-w-7xl">
          <div className="flex h-14 items-center justify-between">
            <BrandMark />
            <div className="hidden items-center gap-4 lg:flex">
              <nav className="flex items-center gap-1">
                {links.map((link) => (
                  <a className={navLink} href={link.href} key={link.href}>
                    {link.label}
                  </a>
                ))}
              </nav>
              <ThemeToggle className={navLink} />
              <WalletReviewButton className={navCta} />
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle className={navLink} />
              <WalletReviewButton className={navCta}>Review</WalletReviewButton>
              <button
                aria-controls="mobile-nav"
                aria-expanded={open}
                aria-label={open ? "Close menu" : "Open menu"}
                className="-mr-2.5 grid size-11 place-items-center text-[var(--landing-muted-fg)]"
                onClick={() => setOpen((value) => !value)}
                type="button"
              >
                <span className="landing-mono text-lg leading-none">{open ? "×" : "☰"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {open ? (
        <div className="border-t border-[var(--landing-border)] bg-[var(--landing-bg)] px-4 py-4 lg:hidden" id="mobile-nav">
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <a className={navLink} href={link.href} key={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
