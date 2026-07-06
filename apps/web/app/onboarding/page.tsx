"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";
import { Business } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatNumber, setVatNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("اكتب اسم المحل أولاً");
      return;
    }
    if (vatEnabled && !vatNumber.trim()) {
      setError("أدخل الرقم الضريبي أو أوقف تفعيل الضريبة");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{ accessToken: string; business: Business }>(
        "/business",
        {
          name: name.trim(),
          vatEnabled,
          vatNumber: vatEnabled ? vatNumber.trim() : undefined,
          city: city.trim() || undefined,
        },
      );
      setToken(res.accessToken);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "تعذر حفظ بيانات المحل",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-700 text-2xl font-extrabold text-white">
            د
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900">
            بيانات المحل
          </h1>
          <p className="text-sm text-gray-500">
            خطوة وحدة وتقدر تبدأ تتابع مبيعاتك ومصاريفك
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="biz-name" className="mb-1.5 block text-sm font-semibold text-gray-700">
              اسم المحل
            </label>
            <input
              id="biz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: بيت الحلا"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div>
            <label htmlFor="biz-city" className="mb-1.5 block text-sm font-semibold text-gray-700">
              المدينة <span className="font-normal text-gray-500">(اختياري)</span>
            </label>
            <input
              id="biz-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="مثال: الرياض"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5">
            <span className="text-sm font-semibold text-gray-700">
              مسجل في ضريبة القيمة المضافة؟
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={vatEnabled}
              onClick={() => setVatEnabled((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                vatEnabled ? "bg-brand-700" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  vatEnabled ? "right-1" : "right-6"
                }`}
              />
            </button>
          </div>

          {vatEnabled && (
            <div>
              <label htmlFor="biz-vat" className="mb-1.5 block text-sm font-semibold text-gray-700">
                الرقم الضريبي
              </label>
              <input
                id="biz-vat"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                dir="ltr"
                placeholder="3xxxxxxxxxxxxx03"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-left text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600"
              />
            </div>
          )}

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
            {loading ? "جاري الحفظ..." : "حفظ والمتابعة"}
          </button>
        </form>
      </div>
    </main>
  );
}
