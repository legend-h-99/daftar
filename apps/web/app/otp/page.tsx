"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardCopy, FlaskConical } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Business, User } from "@/lib/types";

const CODE_LENGTH = 6;

export default function OtpPage() {
  const router = useRouter();
  const [phone, setPhone]               = useState<string | null>(null);
  const [devCode, setDevCode]           = useState<string>("");
  const [digits, setDigits]             = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [resending, setResending]       = useState(false);
  const [shaking, setShaking]           = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");

  /* ─── countdown ─── */
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  /* ─── read session ─── */
  useEffect(() => {
    const raw = sessionStorage.getItem("daftar_otp_flow");
    if (!raw) { router.replace("/login"); return; }
    try {
      const parsed = JSON.parse(raw) as { phone: string; devCode: string };
      setPhone(parsed.phone);
      setDevCode(parsed.devCode || "");
      setTimeout(() => inputsRef.current[0]?.focus(), 200);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  /* ─── core submit ─── */
  async function doVerify(codeToVerify: string) {
    if (!phone || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{
        accessToken: string;
        user: User;
        hasBusiness: boolean;
        business?: Business;
      }>("/auth/otp/verify", { phone, code: codeToVerify });
      setToken(res.accessToken);
      sessionStorage.removeItem("daftar_otp_flow");
      router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "الرمز غير صحيح، حاول مرة أخرى");
      setShaking(true);
      setTimeout(() => {
        setShaking(false);
        setDigits(Array(CODE_LENGTH).fill(""));
        setTimeout(() => inputsRef.current[0]?.focus(), 30);
      }, 420);
    } finally {
      setLoading(false);
    }
  }

  /* ─── auto-submit when complete ─── */
  useEffect(() => {
    if (code.length !== CODE_LENGTH || loading) return;
    const t = setTimeout(() => doVerify(code), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /* ─── input handlers ─── */
  function handleChange(index: number, value: string) {
    setError(null);
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((prev) => { const n = [...prev]; n[index] = ""; return n; });
      return;
    }
    setDigits((prev) => {
      const n = [...prev];
      clean.split("").forEach((c, i) => { if (index + i < CODE_LENGTH) n[index + i] = c; });
      return n;
    });
    inputsRef.current[Math.min(index + clean.length, CODE_LENGTH - 1)]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  /* ─── resend ─── */
  async function handleResend() {
    if (!phone || resendCountdown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const res = await apiPost<{ sent: boolean; devCode?: string }>("/auth/otp/request", { phone });
      if (res.devCode) setDevCode(res.devCode);
      setResendCountdown(60);
      setDigits(Array(CODE_LENGTH).fill(""));
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
    } catch {
      setError("تعذر إعادة الإرسال، حاول مرة أخرى");
    } finally {
      setResending(false);
    }
  }

  /* ─── fill dev code ─── */
  function fillDevCode() {
    if (!devCode) return;
    setError(null);
    const chars = devCode.split("").slice(0, CODE_LENGTH);
    setDigits((prev) => { const n = [...prev]; chars.forEach((c, i) => (n[i] = c)); return n; });
  }

  /* ─── box class ─── */
  function boxClass(i: number) {
    const filled  = digits[i] !== "";
    const hasError = !!error;
    return cn(
      "otp-input h-14 w-12 rounded-2xl border-2 text-center text-xl font-bold outline-none transition-all duration-150",
      hasError
        ? "border-red-300 bg-red-50 text-red-600"
        : filled
        ? "border-brand-400 bg-white text-brand-800"
        : "border-gray-200 bg-gray-50 text-gray-900 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200/60",
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f8f7]">

      {/* ─── Background blobs (same pattern as login) ─── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-4 h-56 w-56 -translate-x-1/2 animate-blob bg-brand-100 opacity-60" />
        <div
          className="absolute left-[35%] top-16 h-32 w-32 animate-blob bg-brand-200 opacity-35"
          style={{ animationDelay: "4s", animationDuration: "12s" }}
        />
        <div className="absolute left-1/2 top-6 h-48 w-48 -translate-x-1/2 animate-spin-slow rounded-full border-2 border-brand-200 opacity-25" />
      </div>

      {/* ─── Content ─── */}
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col px-6 py-10">

        {/* Back button */}
        <button
          type="button"
          onClick={() => router.replace("/login")}
          className="animate-fade-up mb-6 flex items-center gap-1 self-start text-sm font-semibold text-gray-500 transition active:text-gray-800"
        >
          <ChevronRight className="h-4 w-4" />
          تغيير الرقم
        </button>

        {/* Header */}
        <div
          className="animate-fade-up mb-8 flex flex-col items-center gap-2 text-center"
          style={{ animationDelay: "60ms" }}
        >
          <div className="mb-1 flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-brand-700 text-3xl font-extrabold text-white shadow-sm">
            د
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">أدخل رمز التحقق</h1>
          <p className="text-sm text-gray-500">
            أرسلنا رمزاً مكوّناً من 6 أرقام إلى
          </p>
          {phone && (
            <span
              dir="ltr"
              className="rounded-xl bg-white px-3 py-1 text-sm font-bold text-gray-800 shadow-sm ring-1 ring-gray-100"
            >
              {phone}
            </span>
          )}
        </div>

        {/* Dev code banner */}
        {devCode && (
          <button
            type="button"
            onClick={fillDevCode}
            className="animate-fade-up mb-6 flex w-full items-center justify-between rounded-2xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-right transition active:scale-[0.98] active:bg-brand-100"
            style={{ animationDelay: "100ms" }}
          >
            <span className="flex items-center gap-2 text-xs font-bold text-brand-700">
              <FlaskConical className="h-4 w-4" />
              وضع تجريبي — اضغط للملء
            </span>
            <span className="flex items-center gap-2 font-mono text-lg font-extrabold tracking-[0.2em] text-brand-800">
              <ClipboardCopy className="h-4 w-4 text-brand-500" />
              {devCode}
            </span>
          </button>
        )}

        {/* OTP boxes */}
        <div
          className={cn(
            "animate-slide-up",
            shaking && "animate-shake",
          )}
          style={{ animationDelay: "140ms" }}
        >
          <div dir="ltr" className="flex justify-center gap-2.5">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`الرقم ${i + 1} من رمز التحقق`}
                maxLength={CODE_LENGTH}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={boxClass(i)}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="animate-scale-in mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-center text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Submit button */}
        <form
          onSubmit={(e) => { e.preventDefault(); doVerify(code); }}
          className="animate-fade-up mt-6"
          style={{ animationDelay: "200ms" }}
        >
          <button
            type="submit"
            disabled={code.length !== CODE_LENGTH || loading}
            className="w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800 disabled:opacity-50"
          >
            {loading ? "جاري التأكيد..." : "تأكيد الرمز"}
          </button>
        </form>

        {/* Resend */}
        <div
          className="animate-fade-up mt-5 text-center"
          style={{ animationDelay: "260ms" }}
        >
          {resendCountdown > 0 ? (
            <p className="text-sm text-gray-600">
              لم يصلك الرمز؟ أعد المحاولة بعد{" "}
              <span className="font-bold tabular-nums text-gray-600">
                {resendCountdown}
              </span>{" "}
              ث
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="animate-scale-in text-sm font-bold text-brand-700 underline underline-offset-2 disabled:opacity-60"
            >
              {resending ? "جاري الإرسال..." : "أعد إرسال الرمز"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
