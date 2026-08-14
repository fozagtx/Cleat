"use client";

import { usePathname } from "next/navigation";
import { CleatLogo } from "@/components/cleat-logo";

export function AnimatedCleatLogo({ size = 22 }: { size?: number }) {
  const pathname = usePathname();

  return <CleatLogo className="cleat-logo-enter" key={pathname} size={size} />;
}
