import type { ReactNode } from "react";

export function DeskCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`desk-card ${className}`}>
      <header className="space-y-2 p-6 pb-4">
        {eyebrow ? (
          <p className="landing-mono text-sm tracking-[0.5px] text-[var(--landing-muted-fg)]">{eyebrow}</p>
        ) : null}
        <h2 className="text-xl font-medium tracking-[-0.5px] sm:text-2xl">{title}</h2>
        {description ? (
          <p className="max-w-xl text-pretty text-sm leading-relaxed text-[var(--landing-muted-fg)] sm:text-base">
            {description}
          </p>
        ) : null}
      </header>
      {children ? <div className="px-6 pb-6">{children}</div> : null}
      {footer ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--landing-border)] px-6 py-4">{footer}</div>
      ) : null}
    </section>
  );
}

export function DeskSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="desk-card p-6">
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div className="desk-skeleton" key={index} />
        ))}
      </div>
    </div>
  );
}
