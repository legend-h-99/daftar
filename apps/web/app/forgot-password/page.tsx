"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";

export default function ForgotPasswordPage() {
  const { language } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const BackIcon = language === "ar" ? ArrowRight : ArrowLeft;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost("/auth/password/forgot", { email }, { auth: false });
      setSent(true);
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
      className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-border bg-accent/40" />

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
        <div
          className="motion-surface animate-slide-up rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <Link
            href="/login"
            className="mb-5 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
          >
            <BackIcon className="h-4 w-4" />
            {language === "ar" ? "العودة لتسجيل الدخول" : "Back to sign in"}
          </Link>

          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600 dark:text-green-400" />
              <h1 className="text-lg font-extrabold text-foreground">
                {language === "ar" ? "تحقق من بريدك" : "Check your email"}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {language === "ar"
                  ? "إذا كان هذا البريد مسجّلاً عندنا، أرسلنا رابط إعادة تعيين كلمة المرور إليه."
                  : "If that email is registered with us, we've sent a password reset link to it."}
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-extrabold text-foreground">
                {language === "ar" ? "نسيت كلمة المرور؟" : "Forgot your password?"}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {language === "ar"
                  ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور."
                  : "Enter your email and we'll send you a password reset link."}
              </p>

              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
                <div>
                  <label htmlFor="email" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    {language === "ar" ? "البريد الإلكتروني" : "Email"}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    autoComplete="email"
                    inputMode="email"
                    dir="ltr"
                    placeholder="you@example.com"
                    className={cn(fieldClass, "py-3 text-left")}
                    required
                  />
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
                    ? (language === "ar" ? "جاري الإرسال..." : "Sending...")
                    : (language === "ar" ? "إرسال رابط إعادة التعيين" : "Send reset link")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
