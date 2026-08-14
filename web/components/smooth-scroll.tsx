"use client";

import type { ReactNode } from "react";
import { ReactLenis } from "lenis/react";

export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      options={{
        anchors: { offset: -64 },
        autoRaf: true,
        lerp: 0.1,
        respectReducedMotion: true,
        smoothWheel: true,
        stopInertiaOnNavigate: true,
      }}
      root
    >
      {children}
    </ReactLenis>
  );
}
