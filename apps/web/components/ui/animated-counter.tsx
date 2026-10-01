"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  to: number;
  duration?: number;
  format: (n: number) => string;
  className?: string;
}

export function AnimatedCounter({ to, duration = 700, format, className }: Props) {
  const [current, setCurrent] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip the animation when motion is reduced or the tab is hidden
    // (browsers pause requestAnimationFrame in background tabs, which would
    // leave the number stuck mid-count).
    if (
      typeof window !== "undefined" &&
      (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState === "hidden")
    ) {
      setCurrent(to);
      fromRef.current = to;
      return;
    }

    const from = fromRef.current;
    let startTime: number | null = null;

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      if (t < 1) {
        setCurrent(from + (to - from) * eased);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Land exactly on the target so halalas are never rounded away.
        setCurrent(to);
        fromRef.current = to;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // If interrupted, snap to the target instead of staying mid-count.
      setCurrent(to);
      fromRef.current = to;
    };
  }, [to, duration]);

  return <span className={className}>{format(current)}</span>;
}
