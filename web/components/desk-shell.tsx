"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  History,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  ScanSearch,
  Sun,
  Unplug,
  WalletCards,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { AnimatedCleatLogo } from "@/components/animated-cleat-logo";
import { BrandMark } from "@/components/brand-mark";
import { rankConnectors } from "@/components/connect-wallet";
import { useLandingTheme } from "@/components/landing/theme";
import { coston2 } from "@/lib/wagmi";

const links = [
  { href: "/borrower", label: "Invoices", Icon: FileText },
  { href: "/lender", label: "Review", Icon: ScanSearch },
  { href: "/activity", label: "History", Icon: History },
] as const;

export function DeskShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const showLabels = !collapsed || mobileOpen;

  return (
    <div className="desk-shell" data-collapsed={collapsed && !mobileOpen}>
      <header className="desk-mobile-bar">
        <BrandMark />
        <button
          aria-expanded={mobileOpen}
          aria-label="Open sidebar"
          className="grid size-10 place-items-center rounded-2xl border border-[var(--landing-border)]"
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <Menu aria-hidden size={18} />
        </button>
      </header>

      {mobileOpen ? (
        <button
          aria-label="Close sidebar"
          className="desk-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        aria-label="Desk navigation"
        className={`desk-sidebar ${mobileOpen ? "is-mobile-open" : ""}`}
      >
        <div className={`flex min-h-11 items-center ${showLabels ? "justify-between gap-3" : "flex-col gap-3"}`}>
          {showLabels ? (
            <BrandMark />
          ) : (
            <NextLink aria-label="Cleat home" className="text-[var(--landing-brand)]" href="/">
              <AnimatedCleatLogo size={22} />
            </NextLink>
          )}
          <button
            aria-expanded={!collapsed}
            aria-label={mobileOpen ? "Close sidebar" : collapsed ? "Open sidebar" : "Close sidebar"}
            className="group relative grid size-10 shrink-0 place-items-center rounded-2xl border border-[var(--landing-border)] text-[var(--landing-fg)] hover:bg-[var(--landing-muted)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring)]"
            onClick={() => {
              if (mobileOpen) {
                setMobileOpen(false);
                return;
              }
              setCollapsed((value) => !value);
            }}
            type="button"
          >
            {mobileOpen ? (
              <X aria-hidden size={18} />
            ) : collapsed ? (
              <PanelLeftOpen aria-hidden size={18} />
            ) : (
              <PanelLeftClose aria-hidden size={18} />
            )}
            <DeskTooltip>{mobileOpen ? "Close sidebar" : collapsed ? "Open sidebar" : "Close sidebar"}</DeskTooltip>
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <NextLink
                aria-current={active ? "page" : undefined}
                aria-label={!showLabels ? label : undefined}
                className={`group relative flex min-h-11 items-center rounded-2xl text-sm text-[var(--landing-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring)] ${
                  showLabels ? "gap-3 px-3" : "justify-center px-0"
                } ${active ? "bg-[var(--landing-muted)]" : "hover:bg-[var(--landing-muted)]/60"}`}
                href={href}
                key={href}
                onClick={() => setMobileOpen(false)}
              >
                <Icon aria-hidden size={18} strokeWidth={1.8} />
                {showLabels ? <span>{label}</span> : null}
                {!showLabels ? <DeskTooltip>{label}</DeskTooltip> : null}
              </NextLink>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-[var(--landing-border)] pt-4">
          <SidebarTheme showLabel={showLabels} />
          <SidebarWallet showLabel={showLabels} />
        </div>
      </aside>
      <div className="desk-content">{children}</div>
    </div>
  );
}

function DeskTooltip({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-xl bg-[var(--landing-primary)] px-2.5 py-1.5 text-xs text-[var(--landing-primary-fg)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

function SidebarTheme({ showLabel }: { showLabel: boolean }) {
  const { theme, setTheme } = useLandingTheme();
  const next = theme === "light" ? "dark" : "light";

  return (
    <button
      aria-label={`Switch to ${next} mode`}
      className={`group relative flex min-h-11 items-center rounded-2xl text-sm text-[var(--landing-fg)] hover:bg-[var(--landing-muted)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring)] ${
        showLabel ? "gap-3 px-3" : "justify-center px-0"
      }`}
      onClick={() => setTheme(next)}
      type="button"
    >
      {theme === "light" ? <Sun aria-hidden size={18} /> : <Moon aria-hidden size={18} />}
      {showLabel ? <span>{theme === "light" ? "Dark mode" : "Light mode"}</span> : null}
      {!showLabel ? <DeskTooltip>{theme === "light" ? "Dark mode" : "Light mode"}</DeskTooltip> : null}
    </button>
  );
}

function SidebarWallet({ showLabel }: { showLabel: boolean }) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== coston2.id;
  const label = !isConnected
    ? isPending
      ? "Connecting…"
      : "Connect wallet"
    : wrongNetwork
      ? isSwitching
        ? "Switching…"
        : "Switch network"
      : `${address?.slice(0, 6)}…${address?.slice(-4)}`;

  async function act() {
    if (wrongNetwork) {
      switchChain({ chainId: coston2.id });
      return;
    }
    if (isConnected) {
      disconnect();
      return;
    }
    for (const connector of rankConnectors(connectors)) {
      const provider = await connector.getProvider().catch(() => undefined);
      if (!provider) continue;
      connect({ connector });
      return;
    }
  }

  return (
    <button
      aria-label={isConnected && !wrongNetwork ? `Disconnect ${address}` : label}
      className={`group relative flex min-h-11 items-center rounded-2xl text-sm text-[var(--landing-fg)] hover:bg-[var(--landing-muted)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring)] disabled:opacity-50 ${
        showLabel ? "gap-3 px-3" : "justify-center px-0"
      }`}
      disabled={isPending || isSwitching}
      onClick={act}
      type="button"
    >
      {!isConnected ? (
        <WalletCards aria-hidden size={18} />
      ) : wrongNetwork ? (
        <Radio aria-hidden size={18} />
      ) : (
        <Unplug aria-hidden size={18} />
      )}
      {showLabel ? <span className={isConnected && !wrongNetwork ? "landing-mono text-xs" : ""}>{label}</span> : null}
      {!showLabel ? <DeskTooltip>{isConnected && !wrongNetwork ? "Disconnect wallet" : label}</DeskTooltip> : null}
    </button>
  );
}
