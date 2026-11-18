"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Fires landing_viewed once and counts clicks on any sign-in CTA (links to /login
// inside <main>, not the footer). Keeps the landing page itself a server component.
// The static export renders links as "/login/", so compare the resolved pathname
// instead of the raw href attribute.
export default function LandingTracker() {
  useEffect(() => {
    track("landing_viewed");
    function onClick(event: MouseEvent) {
      const link = (event.target as HTMLElement | null)?.closest?.<HTMLAnchorElement>("main a[href]");
      if (!link || link.closest("footer") || new URL(link.href, location.href).pathname.replace(/\/+$/, "") !== "/login") return;
      track("cta_clicked", { location: link.closest("header") ? "header" : "body" });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
