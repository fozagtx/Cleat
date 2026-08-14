"use client";

import type { ReactNode } from "react";
import { useAccount, useConnect } from "wagmi";
import { rankConnectors } from "@/components/connect-wallet";

export function WalletReviewButton({
  children = "Review an invoice",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  return (
    <button
      className={className}
      disabled={isPending || isConnected}
      onClick={async () => {
        for (const connector of rankConnectors(connectors)) {
          const provider = await connector.getProvider().catch(() => undefined);
          if (!provider) continue;
          connect({ connector });
          return;
        }
      }}
      type="button"
    >
      {isPending ? "Connecting…" : isConnected ? "Connected" : children}
    </button>
  );
}
