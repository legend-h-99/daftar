"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Fires landing_viewed once and counts clicks on any sign-in CTA (links to /login
// inside <main>, not the footer). Keeps the landing page itself a server component.
export default function LandingTracker() {
  useEffect(() => {
    track("landing_viewed");
    function onClick(event: MouseEvent) {
      const link = (event.target as HTMLElement | null)?.closest?.('main a[href="/login"]');
      if (!link || link.closest("footer")) return;
      track("cta_clicked", { location: link.closest("header") ? "header" : "body" });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
