import Image from "next/image";
import type { ReactNode } from "react";

export function PhotoStage({
  src,
  children,
}: {
  src: string;
  children: ReactNode;
}) {
  return (
    <div className="relative w-full overflow-hidden sm:min-h-[300px] lg:aspect-[4/3]">
      <Image
        alt=""
        className="object-cover"
        fill
        sizes="(min-width: 1280px) 640px, 100vw"
        src={src}
      />
      <div className="absolute inset-0 bg-[var(--landing-photo-scrim)]" />
      <div className="relative flex min-h-[280px] items-center justify-center p-4 sm:min-h-[300px] sm:p-8 lg:h-full">
        {children}
      </div>
    </div>
  );
}

export function MockupShell({
  title,
  children,
  sidebar,
  wide,
}: {
  title: string;
  children: ReactNode;
  sidebar?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`w-full overflow-hidden border border-[var(--preview-border)] bg-[var(--preview-sidebar)] text-[var(--preview-fg)] shadow-[0_24px_80px_rgb(0_0_0_/0.45)] ${wide ? "max-w-5xl" : "max-w-[620px]"}`}
      style={{ borderRadius: "var(--mockup-shell-radius)" }}
    >
      <div className="flex items-center gap-3 border-b border-[var(--preview-divider)] px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-[10px] rounded-full bg-[#ff5f57]" />
          <span className="size-[10px] rounded-full bg-[#febc2e]" />
          <span className="size-[10px] rounded-full bg-[#28c840]" />
        </div>
        <p className="landing-mono truncate text-[11px] tracking-[0.3px] text-[var(--preview-muted)]">{title}</p>
      </div>
      <div className={sidebar ? "grid grid-cols-[132px_1fr]" : undefined}>
        {sidebar ? (
          <aside className="hidden border-r border-[var(--preview-divider)] bg-[var(--preview-sidebar)] p-3 sm:block">
            {sidebar}
          </aside>
        ) : null}
        <div className="bg-[var(--preview-card)]">{children}</div>
      </div>
    </div>
  );
}
