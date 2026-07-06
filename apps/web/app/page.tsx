"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(isAuthenticated() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-xl font-extrabold text-white">
        د
      </span>
    </div>
  );
}
