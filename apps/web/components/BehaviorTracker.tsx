"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPage } from "@/lib/analytics";
export default function BehaviorTracker() {
  const pathname = usePathname();
  useEffect(() => { if (pathname) trackPage(pathname); }, [pathname]);
  return null;
}
