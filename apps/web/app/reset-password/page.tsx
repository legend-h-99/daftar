"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Lock, Eye, EyeOff } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";
import AuthBrand from "@/components/AuthBrand";
import { Business, User } from "@/lib/types";

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const { language } = useLanguage();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(
        language === "ar"
          ? "كلمة المرور لازم تكون 8 أحرف على الأقل"
          : "Password must be at least 8 characters",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost<{ accessToken: string; user: User; hasBusiness: boolean; business?: Business }>(
        "/auth/password/reset",
        { token, password },
        { auth: false },
      );
      setToken(res.accessToken);
      setSuccess(true);
      setTimeout(() => {
        router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : language === "ar" ? "حدث خطأ، حاول مرة أخرى" : "Something went wrong, please try again",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="relative flex min-h-screen flex-col items-center overflow-hidden bg-background text-foreground px-6 py-12"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-border bg-accent/40" />

      <div className="relative z-10">
        <AuthBrand />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-slide-up rounded-2xl border border-border bg-card p-8 shadow-sm">
        {!token ? (
          <div className="text-center">
            <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h1 className="text-xl font-extrabold text-foreground">
              {language === "ar" ? "رابط غير صالح" : "Invalid link"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {language === "ar"
                ? "رابط إعادة تعيين كلمة المرور غير صالح أو غير مكتمل."
                : "This password reset link is invalid or incomplete."}
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              {language === "ar" ? "طلب رابط جديد" : "Request a new link"}
            </Link>
          </div>
        ) : success ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h1 className="text-xl font-extrabold text-foreground">
              {language === "ar" ? "تم تغيير كلمة المرور!" : "Password changed!"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {language === "ar" ? "جاري تحويلك إلى حسابك..." : "Taking you to your account..."}
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-foreground">
              {language === "ar" ? "كلمة مرور جديدة" : "New password"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {language === "ar" ? "اختر كلمة مرور جديدة لحسابك." : "Choose a new password for your account."}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <div>
                <label htmlFor="password" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  {language === "ar" ? "كلمة المرور الجديدة" : "New password"}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    autoComplete="new-password"
                    dir="ltr"
                    placeholder={language === "ar" ? "8 أحرف على الأقل" : "At least 8 characters"}
                    className={cn(fieldClass, "py-3 text-left pr-11")}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    aria-label={language === "ar" ? (showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور") : (showPassword ? "Hide password" : "Show password")}
                    aria-pressed={showPassword}
                    aria-controls="password"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-lg text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="animate-scale-in rounded-xl bg-red-50 dark:bg-red-950 px-3 py-2.5 text-center text-sm font-medium text-red-600 dark:text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="motion-press mt-1 w-full rounded-2xl bg-brand-700 py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800 disabled:opacity-60"
              >
                {loading
                  ? (language === "ar" ? "جاري الحفظ..." : "Saving...")
                  : (language === "ar" ? "حفظ كلمة المرور" : "Save password")}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <SuspenseBoundary>
      <ResetPasswordContent />
    </SuspenseBoundary>
  );
}

// Keep the boundary compatible with the workspace's React 19 type packages.
// Next still requires a Suspense boundary for useSearchParams during export.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SuspenseBoundary = (require("react") as any).Suspense;
