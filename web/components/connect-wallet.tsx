"use client";

import { useState } from "react";
import { type Connector, useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { navCta, navLink } from "@/components/landing/chrome";
import { coston2 } from "@/lib/wagmi";

export function rankConnectors(connectors: readonly Connector[]) {
  const preferred = connectors.filter(
    (connector) => connector.id === "io.metamask" || connector.id === "metaMask",
  );
  const rest = connectors.filter(
    (connector) => connector.id !== "io.metamask" && connector.id !== "metaMask",
  );
  return [...preferred, ...rest];
}

function connectCopy(error: Error | null, missingWallet: boolean) {
  if (missingWallet) return "No wallet in this browser.";
  if (!error) return null;
  const short =
    "shortMessage" in error && typeof error.shortMessage === "string" ? error.shortMessage : error.message.split("\n")[0];
  const text = `${error.name} ${short}`.toLowerCase();
  if (error.name === "ProviderNotFoundError" || text.includes("provider not found")) {
    return "No wallet in this browser.";
  }
  if (error.name === "UserRejectedRequestError" || text.includes("rejected")) {
    return "Request cancelled.";
  }
  return "Could not connect.";
}

export function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [missingWallet, setMissingWallet] = useState(false);
  const copy = connectCopy(error, missingWallet);

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        <button
          className={navCta}
          disabled={isPending || connectors.length === 0}
          onClick={async () => {
            for (const connector of rankConnectors(connectors)) {
              const provider = await connector.getProvider().catch(() => undefined);
              if (!provider) continue;
              setMissingWallet(false);
              connect({ connector });
              return;
            }
            setMissingWallet(true);
          }}
          type="button"
        >
          {isPending ? "Connecting…" : "Connect"}
        </button>
        {copy ? <p className="max-w-[11rem] truncate text-xs text-[var(--landing-danger)]">{copy}</p> : null}
      </div>
    );
  }

  const wrong = chainId !== coston2.id;

  return (
    <div className="flex items-center gap-2">
      <p className="landing-mono text-sm tabular-nums text-[var(--landing-muted-fg)]">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </p>
      {wrong ? (
        <button
          className={navCta}
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: coston2.id })}
          type="button"
        >
          Switch network
        </button>
      ) : (
        <button className={navLink} onClick={() => disconnect()} type="button">
          Disconnect
        </button>
      )}
    </div>
  );
}
