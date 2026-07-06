"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCopy, FlaskConical } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Business, User } from "@/lib/types";

const CODE_LENGTH = 6;

export default function OtpPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string>("");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem("daftar_otp_flow");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { phone: string; devCode: string };
      setPhone(parsed.phone);
      setDevCode(parsed.devCode || "");
    } catch {
      router.replace("/login");
    }
  }, [router]);

  function handleChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      // support pasting the full code into one box
      const chars = clean.split("");
      chars.forEach((c, i) => {
        if (index + i < CODE_LENGTH) next[index + i] = c;
      });
      return next;
    });
    const nextIndex = Math.min(index + clean.length, CODE_LENGTH - 1);
    inputsRef.current[nextIndex]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function fillDevCode() {
    if (!devCode) return;
    const chars = devCode.split("").slice(0, CODE_LENGTH);
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((c, i) => (next[i] = c));
      return next;
    });
  }

  const code = digits.join("");
  const isValid = code.length === CODE_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !phone) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{
        accessToken: string;
        user: User;
        hasBusiness: boolean;
        business?: Business;
      }>("/auth/otp/verify", { phone, code });
      setToken(res.accessToken);
      sessionStorage.removeItem("daftar_otp_flow");
      router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "الرمز غير صحيح، حاول مرة أخرى",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-extrabold text-gray-900">
            أدخل رمز التحقق
          </h1>
          <p className="text-sm text-gray-500">
            أرسلنا رمز مكوّن من 6 أرقام إلى
            {phone ? (
              <span dir="ltr" className="mx-1 font-semibold text-gray-800">
                {phone}
              </span>
            ) : null}
          </p>
        </div>

        {devCode && (
          <button
            type="button"
            onClick={fillDevCode}
            className="mb-6 flex w-full items-center justify-between rounded-2xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-right"
          >
            <span className="flex items-center gap-2 text-xs font-bold text-brand-700">
              <FlaskConical className="h-4 w-4" />
              وضع تجريبي
            </span>
            <span className="flex items-center gap-1.5 text-lg font-extrabold tracking-widest text-brand-800">
              <ClipboardCopy className="h-4 w-4 text-brand-500" />
              {devCode}
            </span>
          </button>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div dir="ltr" className="flex justify-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                // one-time-code on the first box lets the OS/keychain offer the
                // SMS code for autofill (WCAG 1.3.5).
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`الرقم ${i + 1} من رمز التحقق`}
                maxLength={CODE_LENGTH}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="otp-input h-14 w-11 rounded-2xl border border-gray-200 bg-gray-50 text-center text-xl font-bold text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600"
              />
            ))}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition active:bg-brand-800 disabled:opacity-60"
          >
            {loading ? "جاري التأكيد..." : "تأكيد"}
          </button>
        </form>
      </div>
    </main>
  );
}
