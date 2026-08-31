"use client";

import { useRouter } from "next/navigation";
import { Languages, LogOut, Sun, Moon } from "lucide-react";
import { clearToken } from "@/lib/auth";
import { apiPost } from "@/lib/api";
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
    } catch {
      // If request fails, still sign out locally.
    } finally {
      clearToken();
      router.replace("/login");
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
          {businessName && (
            <span className="max-w-[100px] truncate text-sm font-medium text-muted-foreground">
              {businessName}
            </span>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
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
