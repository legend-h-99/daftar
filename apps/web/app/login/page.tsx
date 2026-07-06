"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";

const PHONE_REGEX = /^05\d{8}$/;

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid = PHONE_REGEX.test(phone);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setError("رقم الجوال غير صحيح، تأكد إنه يبدأ بـ 05 ومكوّن من 10 أرقام");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{ sent: boolean; devCode?: string }>(
        "/auth/otp/request",
        { phone },
      );
      sessionStorage.setItem(
        "daftar_otp_flow",
        JSON.stringify({ phone, devCode: res.devCode || "" }),
      );
      router.push("/otp");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "تعذر إرسال رمز التحقق، حاول مرة أخرى",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-700 text-3xl font-extrabold text-white">
            د
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900">دفتر</h1>
          <p className="text-sm text-gray-500">
            سجّل دخولك برقم جوالك وتابع حسابات محلك بكل سهولة
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-sm font-semibold text-gray-700"
            >
              رقم الجوال
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                dir="ltr"
                placeholder="05xxxxxxxx"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-4 pr-11 text-left text-lg font-semibold tracking-wide text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition active:bg-brand-800 disabled:opacity-60"
          >
            {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
          </button>
        </form>
      </div>
    </main>
  );
}
