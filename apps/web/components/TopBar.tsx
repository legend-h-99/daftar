"use client";

import { useRouter } from "next/navigation";
import { Languages, LogOut } from "lucide-react";
import { clearToken } from "@/lib/auth";
import { apiPost } from "@/lib/api";
import { useLanguage } from "@/lib/language";

interface TopBarProps {
  businessName?: string | null;
}

export default function TopBar({ businessName }: TopBarProps) {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();

  async function handleSignOut() {
    try {
      await apiPost("/auth/logout", {});
    } catch {
      // If request fails, still sign out locally.
    } finally {
      clearToken();
      router.replace("/login");
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-700 text-base font-extrabold text-white">
            {language === "ar" ? "د" : "D"}
          </span>
          <span className="text-lg font-extrabold text-gray-900">
            {language === "ar" ? "دفتر" : "Daftar"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {businessName && (
            <span className="max-w-[100px] truncate text-sm font-medium text-gray-600">
              {businessName}
            </span>
          )}

          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            className="flex h-11 items-center gap-1 rounded-full px-2 text-xs font-bold text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200"
          >
            <Languages className="h-4 w-4" />
            {language === "ar" ? "EN" : "ع"}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            aria-label={language === "ar" ? "تسجيل الخروج" : "Sign out"}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
