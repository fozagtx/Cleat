import NextLink from "next/link";
import type { ReactNode } from "react";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--landing-bg)]";

export const primaryBtn =
  `landing-primary-btn inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--landing-primary)] px-6 py-3 text-sm font-semibold tracking-[-0.5px] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const secondaryBtn =
  `inline-flex min-h-11 items-center justify-center rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-bg)] px-5 py-3 text-sm text-[var(--landing-fg)] transition-colors hover:bg-[var(--landing-muted)]/60 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const ghostBtn =
  `inline-flex min-h-10 items-center justify-center rounded-2xl border border-[var(--landing-border)] bg-transparent px-4 py-2 text-sm text-[var(--landing-fg)] transition-colors hover:bg-[var(--landing-muted)]/60 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const navCta =
  `landing-primary-btn inline-flex h-8 items-center justify-center rounded-2xl bg-[var(--landing-primary)] px-3 text-sm font-semibold tracking-[-0.5px] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const navLink =
  `inline-flex h-8 items-center rounded-2xl border border-transparent bg-transparent px-3 text-sm text-[var(--landing-fg)] transition-colors hover:border-[var(--landing-border)] hover:bg-[var(--landing-muted)]/40 ${focusRing}`;

export function SectionShell({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative px-4 py-16 sm:px-8 sm:py-20 lg:px-[30px] lg:py-24 ${className}`} id={id}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function TextLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <NextLink className={className} href={href}>
      {children}
    </NextLink>
  );
}
