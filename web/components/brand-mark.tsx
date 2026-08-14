"use client";

import NextLink from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { AnimatedCleatLogo } from "@/components/animated-cleat-logo";

export function BrandMark() {
  const [isScrolling, setIsScrolling] = useState(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLenis((lenis) => {
    if (Math.abs(lenis.velocity) < 0.01 && !lenis.isScrolling) return;

    setIsScrolling(true);
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => setIsScrolling(false), 140);
  });

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
    },
    [],
  );

  return (
    <NextLink
      className={`brand-mark flex items-center gap-2 text-[var(--landing-fg)] no-underline ${isScrolling ? "is-scrolling" : ""}`}
      href="/"
    >
      <span className="brand-mark-logo text-[var(--landing-brand)]">
        <AnimatedCleatLogo size={22} />
      </span>
      <span className="brand-mark-name text-sm font-medium">Cleat</span>
    </NextLink>
  );
}
