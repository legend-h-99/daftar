"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { clearToken } from "@/lib/auth";

interface TopBarProps {
  businessName?: string | null;
}

export default function TopBar({ businessName }: TopBarProps) {
  const router = useRouter();

  function handleSignOut() {
    clearToken();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-700 text-base font-extrabold text-white">
            د
          </span>
          <span className="text-lg font-extrabold text-gray-900">دفتر</span>
        </div>
        <div className="flex items-center gap-2">
          {businessName && (
            <span className="max-w-[120px] truncate text-sm font-medium text-gray-500">
              {businessName}
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="تسجيل الخروج"
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
