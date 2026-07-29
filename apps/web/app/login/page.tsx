"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { DEMO_MODE, DEMO_TOKEN } from "@/lib/demo-api";
import { setToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";

const PHONE_REGEX = /^05\d{8}$/;
const SERVER_DEMO_LOGIN = process.env.NEXT_PUBLIC_DEMO_LOGIN === "true";

const DEMO_STORES = [
  { phone: "0500000001", name: "مطبخ أم سلطان",       city: "الرياض" },
  { phone: "0500000002", name: "مخبزة بيت الخبز",     city: "جدة"    },
  { phone: "0500000003", name: "حلويات أم يوسف",       city: "مكة"    },
  { phone: "0500000004", name: "ورشة العود والبخور",   city: "الدمام"  },
  { phone: "0500000005", name: "خياطة الأناقة",        city: "الرياض" },
  { phone: "0500000006", name: "صابون الطبيعة",        city: "بريدة"  },
  { phone: "0500000007", name: "شموع ولمسات",          city: "الخبر"  },
  { phone: "0500000008", name: "بُنّ الديار",           city: "الرياض" },
];

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone]     = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid = PHONE_REGEX.test(phone);

  async function enterDemo(phoneNumber: string) {
    if (!DEMO_MODE) {
      if (!SERVER_DEMO_LOGIN) {
        setPhone(phoneNumber);
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const res = await apiPost<{ accessToken: string; hasBusiness: boolean }>(
          "/auth/demo",
          { phone: phoneNumber },
        );
        setToken(res.accessToken);
        router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "تعذر دخول الحساب التجريبي");
      } finally {
        setLoading(false);
      }
      return;
    }
    setToken(DEMO_TOKEN);
    router.replace("/dashboard");
  }

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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f8f7]">

      {/* ─── Dynamic background shapes ─── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Primary morphing blob */}
        <div className="absolute left-1/2 top-6 h-60 w-60 -translate-x-1/2 animate-blob bg-brand-100 opacity-70" />
        {/* Secondary smaller blob offset for depth */}
        <div
          className="absolute left-[30%] top-20 h-36 w-36 animate-blob bg-brand-200 opacity-40"
          style={{ animationDelay: "3s", animationDuration: "11s" }}
        />
        {/* Spinning slow ring */}
        <div
          className="absolute left-1/2 top-8 h-52 w-52 -translate-x-1/2 animate-spin-slow rounded-full border-2 border-brand-200 opacity-30"
        />
      </div>

      {/* ─── Content ─── */}
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col px-6 py-12">

        {/* Logo + branding */}
        <div className="mb-10 flex animate-fade-up flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-brand-700 text-3xl font-extrabold text-white shadow-sm">
            د
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900">دفتر</h1>
          <p className="text-sm text-gray-500">
            سجّل دخولك برقم جوالك وتابع حسابات محلك بكل سهولة
          </p>
        </div>

        {/* Form card */}
        <div
          className="animate-slide-up rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
          style={{ animationDelay: "120ms" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                رقم الجوال
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
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
                  className={cn(
                    fieldClass,
                    "py-3.5 pr-11 text-left text-lg font-semibold tracking-wide",
                  )}
                />
              </div>
            </div>

            {error && (
              <p className="animate-scale-in rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800 disabled:opacity-60"
            >
              {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <p className="mb-3 text-center text-xs font-semibold text-gray-600">
              حسابات تجريبية
            </p>
            <div className="flex flex-col gap-2">
              {DEMO_STORES.map((store, i) => (
                <button
                  key={store.phone}
                  type="button"
                  onClick={() => enterDemo(store.phone)}
                  style={{ animationDelay: `${200 + i * 60}ms` }}
                  className="animate-fade-up flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-right transition-all active:scale-[0.98] active:bg-gray-100"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-gray-800">
                      {store.name}
                    </span>
                    <span className="text-xs text-gray-400">{store.city}</span>
                  </div>
                  <span dir="ltr" className="font-mono text-sm font-medium text-brand-700">
                    {store.phone}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-gray-600">
              {DEMO_MODE
                ? "اضغط على أي حساب للدخول مباشرة"
                : SERVER_DEMO_LOGIN
                ? "اضغط على أي حساب للدخول عبر السيرفر"
                : "رمز التحقق يظهر تلقائياً في الوضع التجريبي"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
