"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";

const DESK_PREFIXES = ["/borrower", "/lender", "/activity"];

function isDesk(pathname: string) {
  return DESK_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function WalletRouteGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected, status } = useAccount();

  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") return;
    if (isConnected && pathname === "/") {
      router.replace("/borrower");
      return;
    }
    if (!isConnected && isDesk(pathname)) {
      router.replace("/");
    }
  }, [isConnected, pathname, router, status]);

  return null;
}
