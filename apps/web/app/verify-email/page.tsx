"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Business, User } from "@/lib/types";
import EmailAuthGate from "@/components/EmailAuthGate";

type VerifyResponse = {
  accessToken?: string; sessionAuthenticated?: boolean;
  user: User;
  hasBusiness: boolean;
  business?: Business;
};

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState<"form" | "submitting" | "success" | "error">(token ? "form" : "error");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(token ? "" : "رابط التحقق غير صالح");

  // The link alone never activates the account: the mailbox owner chooses the password here.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setStatus("submitting");
    apiPost<VerifyResponse>("/auth/email/verify", { token, password })
      .then((res) => {
        setToken(res.accessToken, res.sessionAuthenticated);
        setStatus("success");
        setTimeout(() => {
          router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
        }, 2000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "رابط التحقق غير صالح أو منتهي الصلاحية");
      });
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-border bg-accent/40" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <div className="mb-6 flex justify-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-700 text-2xl font-extrabold text-white shadow-sm"
            >
              د
            </span>
          </div>

          {(status === "form" || status === "submitting") && (
            <>
              <h1 className="text-xl font-extrabold text-foreground">أكمل تفعيل حسابك</h1>
              <p className="mt-2 text-sm text-muted-foreground">اختر كلمة مرور لحسابك، 8 أحرف على الأقل.</p>
              <form onSubmit={submit} className="mt-6 space-y-4 text-right">
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    كلمة المرور الجديدة
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    dir="ltr"
                    placeholder="8 أحرف على الأقل"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm text-foreground"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {status === "submitting" ? "جاري التفعيل..." : "تفعيل الحساب"}
                </button>
              </form>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h1 className="text-xl font-extrabold text-foreground">تم تأكيد البريد الإلكتروني!</h1>
              <p className="mt-2 text-sm text-muted-foreground">جاري تحويلك إلى حسابك...</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h1 className="text-xl font-extrabold text-foreground">فشل التحقق</h1>
              <p className="mt-2 text-sm text-muted-foreground">{message}</p>
              <button
                onClick={() => router.replace("/login")}
                className="mt-6 w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground"
              >
                العودة لتسجيل الدخول
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

const S = Suspense as any;

export default function VerifyEmailPage() {
  return (
    <EmailAuthGate><S>
      <VerifyEmailContent />
    </S></EmailAuthGate>
  );
}
