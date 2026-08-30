"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Business, User } from "@/lib/types";

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("رابط التحقق غير صالح");
      return;
    }

    apiPost<{
      accessToken: string;
      user: User;
      hasBusiness: boolean;
      business?: Business;
    }>("/auth/email/verify", { token })
      .then((res) => {
        setToken(res.accessToken);
        setStatus("success");
        setTimeout(() => {
          router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
        }, 2000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "رابط التحقق غير صالح أو منتهي الصلاحية");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-border bg-accent/40" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <div className="mb-6 flex justify-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-extrabold text-white shadow-sm"
              style={{ backgroundImage: "linear-gradient(135deg, #4C1D95, #7C3AED)" }}
            >
              د
            </span>
          </div>

          {status === "loading" && (
            <>
              <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
              <h1 className="text-lg font-bold text-foreground">جاري التحقق...</h1>
              <p className="mt-2 text-sm text-muted-foreground">يرجى الانتظار</p>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S = (require("react") as any).Suspense;

export default function VerifyEmailPage() {
  return (
    <S>
      <VerifyEmailContent />
    </S>
  );
}
