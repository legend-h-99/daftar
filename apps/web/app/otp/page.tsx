"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardCopy, FlaskConical } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

// Written by the login page when the code is sent.
const OTP_FLOW_KEY = "daftar_otp_flow";
const RESEND_SECONDS = 60;

type OtpFlow = { phone: string; devCode?: string; codeLength?: number };

// The server sends the length set on the Authentica application; anything odd falls back to 6.
function safeLength(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 4 && value <= 8 ? value : 6;
}

export default function OtpPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const ar = language === "ar";
  const [phone, setPhone] = useState<string | null>(null);
  const [devCode, setDevCode] = useState("");
  const [codeLength, setCodeLength] = useState(6);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  useEffect(() => {
    let flow: OtpFlow | null = null;
    try { flow = JSON.parse(sessionStorage.getItem(OTP_FLOW_KEY) ?? "null") as OtpFlow | null; } catch {}
    if (!flow?.phone) { router.replace("/login"); return; }
    const length = safeLength(flow.codeLength);
    setPhone(flow.phone);
    setDevCode(flow.devCode ?? "");
    setCodeLength(length);
    setDigits(Array(length).fill(""));
    setTimeout(() => inputsRef.current[0]?.focus(), 200);
  }, [router]);

  function messageFor(err: unknown): string {
    const status = err instanceof ApiError ? err.status : 0;
    if (status === 400 || status === 401) return ar ? "الرمز غير صحيح أو انتهت صلاحيته" : "The code is wrong or has expired";
    if (status === 429) return ar ? "محاولات كثيرة، انتظر دقيقة ثم حاول" : "Too many attempts. Wait a minute and try again";
    if (status === 503) return ar ? "التحقق بالجوال غير متاح الآن، حاول لاحقاً" : "Phone verification is unavailable right now. Try again later";
    return ar ? "تعذر التحقق، حاول مرة أخرى" : "Could not verify the code. Please try again";
  }

  async function doVerify(codeToVerify: string) {
    if (!phone || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{
        accessToken?: string; sessionAuthenticated?: boolean; hasBusiness: boolean; isNewUser?: boolean;
      }>("/auth/otp/verify", { phone, code: codeToVerify }, { auth: false });
      setToken(res.accessToken, res.sessionAuthenticated);
      try { sessionStorage.removeItem(OTP_FLOW_KEY); } catch {}
      if (res.isNewUser) track("user_signed_up", { method: "phone" });
      track("user_signed_in", { method: "phone", has_business: res.hasBusiness });
      router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
    } catch (err) {
      track("login_failed", { method: "phone", status: err instanceof ApiError ? err.status : 0 });
      setError(messageFor(err));
      setShaking(true);
      setTimeout(() => {
        setShaking(false);
        setDigits(Array(codeLength).fill(""));
        setTimeout(() => inputsRef.current[0]?.focus(), 30);
      }, 420);
    } finally {
      setLoading(false);
    }
  }

  // Submit on its own once every box is filled, as SMS autofill does.
  useEffect(() => {
    if (code.length !== codeLength || loading) return;
    const t = setTimeout(() => doVerify(code), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function handleChange(index: number, value: string) {
    setError(null);
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((prev) => { const n = [...prev]; n[index] = ""; return n; });
      return;
    }
    setDigits((prev) => {
      const n = [...prev];
      clean.split("").forEach((c, i) => { if (index + i < codeLength) n[index + i] = c; });
      return n;
    });
    inputsRef.current[Math.min(index + clean.length, codeLength - 1)]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus();
  }

  async function handleResend() {
    if (!phone || resendCountdown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const res = await apiPost<{ sent: boolean; devCode?: string; codeLength?: number }>(
        "/auth/otp/request", { phone }, { auth: false },
      );
      const length = safeLength(res.codeLength);
      if (res.devCode) setDevCode(res.devCode);
      setCodeLength(length);
      setResendCountdown(RESEND_SECONDS);
      setDigits(Array(length).fill(""));
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429
        ? messageFor(err)
        : ar ? "تعذر إعادة الإرسال، حاول مرة أخرى" : "Could not resend the code. Please try again");
    } finally {
      setResending(false);
    }
  }

  function fillDevCode() {
    if (!devCode) return;
    setError(null);
    setDigits(Array.from({ length: codeLength }, (_, i) => devCode[i] ?? ""));
  }

  function boxClass(i: number) {
    return cn(
      "otp-input h-14 w-11 rounded-2xl border-2 text-center text-xl font-bold outline-none transition-all duration-150",
      error
        ? "border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        : digits[i]
          ? "border-brand-400 bg-card text-foreground"
          : "border-border bg-muted text-foreground focus:border-brand-500 focus:bg-card focus:ring-2 focus:ring-brand-200/60",
    );
  }

  const BackIcon = ar ? ChevronRight : ChevronLeft;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground" dir={ar ? "rtl" : "ltr"}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-border bg-accent/40" />

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col px-6 py-10">
        <button
          type="button"
          onClick={() => router.replace("/login")}
          className="motion-press animate-fade-up mb-6 flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground"
        >
          <BackIcon className="h-4 w-4" />
          {ar ? "تغيير الرقم" : "Change number"}
        </button>

        <div className="animate-fade-up mb-8 flex flex-col items-center gap-2 text-center" style={{ animationDelay: "60ms" }}>
          <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-lg bg-brand-700 text-3xl font-extrabold text-white shadow-sm">
            {ar ? "د" : "D"}
          </div>
          <h1 className="text-2xl font-extrabold">{ar ? "أدخل رمز التحقق" : "Enter the verification code"}</h1>
          <p className="text-sm text-muted-foreground">
            {ar ? `أرسلنا رمزاً من ${codeLength} أرقام برسالة SMS إلى` : `We sent a ${codeLength}-digit code by SMS to`}
          </p>
          {phone && (
            <span dir="ltr" className="rounded-xl bg-card px-3 py-1 text-sm font-bold shadow-sm ring-1 ring-border">
              {phone}
            </span>
          )}
        </div>

        {/* Only the local mock API returns a code; the real provider never does. */}
        {devCode && (
          <button
            type="button"
            onClick={fillDevCode}
            className="motion-press animate-fade-up mb-6 flex w-full items-center justify-between rounded-lg border border-dashed border-brand-300 bg-accent px-4 py-3 transition active:scale-[0.98]"
            style={{ animationDelay: "100ms" }}
          >
            <span className="flex items-center gap-2 text-xs font-bold text-primary">
              <FlaskConical className="h-4 w-4" />
              {ar ? "وضع تجريبي — اضغط للملء" : "Test mode — tap to fill"}
            </span>
            <span dir="ltr" className="flex items-center gap-2 font-mono text-lg font-extrabold tracking-[0.2em] text-primary">
              <ClipboardCopy className="h-4 w-4" />
              {devCode}
            </span>
          </button>
        )}

        <div className={cn("animate-slide-up", shaking && "animate-shake")} style={{ animationDelay: "140ms" }}>
          <div dir="ltr" className="flex justify-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={ar ? `الرقم ${i + 1} من رمز التحقق` : `Digit ${i + 1} of the code`}
                aria-invalid={!!error}
                maxLength={codeLength}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={boxClass(i)}
              />
            ))}
          </div>

          {error && (
            <p role="alert" className="animate-scale-in mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-center text-sm font-medium text-red-600 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); doVerify(code); }} className="animate-fade-up mt-6" style={{ animationDelay: "200ms" }}>
          <button
            type="submit"
            disabled={code.length !== codeLength || loading}
            className="motion-press w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800 disabled:opacity-50"
          >
            {loading ? (ar ? "جاري التأكيد..." : "Verifying...") : (ar ? "تأكيد الرمز" : "Verify code")}
          </button>
        </form>

        <div className="animate-fade-up mt-5 text-center" style={{ animationDelay: "260ms" }}>
          {resendCountdown > 0 ? (
            <p className="text-sm text-muted-foreground">
              {ar ? "لم يصلك الرمز؟ أعد الإرسال بعد " : "Didn't get it? Resend in "}
              <span className="font-bold tabular-nums">{resendCountdown}</span>
              {ar ? " ث" : "s"}
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="animate-scale-in min-h-11 text-sm font-bold text-primary underline underline-offset-2 disabled:opacity-60"
            >
              {resending ? (ar ? "جاري الإرسال..." : "Sending...") : (ar ? "أعد إرسال الرمز" : "Resend code")}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
