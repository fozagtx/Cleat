"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { DeskCard } from "@/components/desk-card";
import { primaryBtn } from "@/components/landing/chrome";
import { coston2 } from "@/lib/wagmi";

export function WrongNetworkCard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === coston2.id) return null;

  return (
    <DeskCard
      className="mt-6"
      description="Switch so this check can run."
      footer={
        <button className={primaryBtn} disabled={isPending} onClick={() => switchChain({ chainId: coston2.id })} type="button">
          Switch network
        </button>
      }
      title="Wrong network"
    />
  );
}
