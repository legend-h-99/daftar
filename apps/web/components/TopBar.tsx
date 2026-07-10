"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Palette } from "lucide-react";
import { clearToken } from "@/lib/auth";
import { apiPost } from "@/lib/api";
import { THEMES, useTheme, type ThemeKey } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface TopBarProps {
  businessName?: string | null;
}

export default function TopBar({ businessName }: TopBarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const paletteRef = useRef<HTMLButtonElement>(null);

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
      {/* Main row */}
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-700 text-base font-extrabold text-white">
            د
          </span>
          <span className="text-lg font-extrabold text-gray-900">دفتر</span>
        </div>

        <div className="flex items-center gap-1">
          {businessName && (
            <span className="max-w-[100px] truncate text-sm font-medium text-gray-400">
              {businessName}
            </span>
          )}

          {/* Theme toggle */}
          <button
            ref={paletteRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="تغيير اللون"
            aria-expanded={open}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition",
              open
                ? "bg-brand-50 text-brand-700"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200",
            )}
          >
            <Palette className="h-4 w-4" />
          </button>

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

      {/* Theme picker row */}
      {open && (
        <div className="animate-fade-up border-t border-gray-100 px-4 py-3">
          <p className="mb-2.5 text-xs font-semibold text-gray-400">اختر لون التطبيق</p>
          <div className="flex items-center gap-3">
            {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(
              ([key, { label, hex }]) => {
                const active = theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setTheme(key); setOpen(false); }}
                    aria-label={`ثيم ${label}`}
                    aria-pressed={active}
                    className="flex flex-col items-center gap-1.5 transition active:scale-95"
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
                      style={{
                        backgroundColor: hex,
                        outline: active ? `2px solid ${hex}` : "none",
                        outlineOffset: "3px",
                      }}
                    >
                      {active && (
                        <svg className="h-4 w-4 text-white" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                        </svg>
                      )}
                    </span>
                    <span className={cn(
                      "text-[10px] font-semibold",
                      active ? "text-gray-900" : "text-gray-500",
                    )}>
                      {label}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>
      )}
    </header>
  );
}
