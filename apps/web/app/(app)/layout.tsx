"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import { getToken } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { Business, User } from "@/lib/types";
import { BusinessProvider } from "@/lib/business-context";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  const refresh = useCallback(async () => {
    const me = await apiGet<{ user: User; business: Business | null }>(
      "/auth/me",
    );
    setUser(me.user);
    setBusiness(me.business);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    refresh()
      .then(() => setReady(true))
      .catch(() => {
        router.replace("/login");
      });
  }, [refresh, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f7]">
        <div className="relative flex items-center justify-center">
          {/* Pulsing rings */}
          <span aria-hidden="true" className="absolute h-16 w-16 animate-pulse-ring rounded-full bg-brand-200" />
          <span aria-hidden="true" className="absolute h-16 w-16 animate-pulse-ring rounded-full bg-brand-200" style={{ animationDelay: "0.8s" }} />
          {/* Logo */}
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-xl font-extrabold text-white">
            د
          </span>
        </div>
      </div>
    );
  }

  return (
    <BusinessProvider value={{ user, business, refresh }}>
      <div className="min-h-screen bg-[#f7f8f7]">
        <TopBar businessName={business?.name} />
        <div className="mx-auto max-w-md px-4 pb-24 pt-4">{children}</div>
        <BottomNav />
      </div>
    </BusinessProvider>
  );
}
