"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Languages, LogOut, Sun, Moon } from "lucide-react";
import { clearToken, usesSessionProxy } from "@/lib/auth";
import { apiPost, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language";
import { useTheme } from "@/lib/theme";

interface TopBarProps {
  businessName?: string | null;
}

export default function TopBar({ businessName }: TopBarProps) {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { resolvedTheme, toggleTheme } = useTheme();

  async function handleSignOut() {
    try {
      await apiPost("/auth/logout", {});
    } catch (err) {
      // JavaScript cannot clear an HttpOnly cookie. If the Worker was never
      // reached (or rejected the request before logout), keep the UI honest.
      if (usesSessionProxy() && err instanceof ApiError && [0, 403, 405].includes(err.status)) {
        toast.error(language === "ar"
          ? "تعذر إنهاء الجلسة، تحقق من اتصالك ثم حاول مرة أخرى"
          : "Could not end your session. Check your connection and try again.");
        return;
      }
      // The Worker clears the cookie even when its upstream logout fails.
    }
    clearToken();
    router.replace("/login");
  }

  return (
    <header className="print:hidden sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-extrabold text-white"
            style={{ backgroundImage: "linear-gradient(135deg, #4C1D95, #7C3AED)" }}
          >
            {language === "ar" ? "د" : "D"}
          </span>
          <span className="text-lg font-extrabold text-foreground">
            {language === "ar" ? "دفتر" : "Daftar"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Link href="/plans" className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-muted-foreground">{language === "ar" ? "الباقات" : "Plans"}</Link>
          {businessName && (
            <span className="max-w-[100px] truncate text-sm font-medium text-muted-foreground">
              {businessName}
            </span>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={language === "en"
              ? resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              : resolvedTheme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
            className="motion-press flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            className="motion-press flex h-11 items-center gap-1 rounded-full px-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted"
          >
            <Languages className="h-4 w-4" />
            {language === "ar" ? "EN" : "ع"}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            aria-label={language === "ar" ? "تسجيل الخروج" : "Sign out"}
            className="motion-press flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
