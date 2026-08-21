"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Receipt, ChevronRight, ChevronLeft } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";
import { Business } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";
import { useLanguage } from "@/lib/language";

const STEPS = 2;

const t = {
  ar: {
    bizData: "بيانات المحل",
    subtitle: "خطوتين بس وتبدأ تتابع حسابات محلك",
    step: (n: number) => `الخطوة ${n} من ${STEPS}`,
    bizInfo: "معلومات المحل",
    bizName: "اسم المحل",
    bizNamePlaceholder: "مثال: بيت الحلا",
    bizNameRequired: "اكتب اسم المحل أولاً",
    city: "المدينة",
    cityOptional: "(اختياري)",
    cityPlaceholder: "مثال: الرياض",
    next: "التالي",
    vatSettings: "إعدادات الضريبة",
    vatQuestion: "مسجل في ضريبة القيمة المضافة؟",
    vatNumber: "الرقم الضريبي",
    vatNumberPlaceholder: "3xxxxxxxxxxxxx03",
    vatRequired: "أدخل الرقم الضريبي أو أوقف تفعيل الضريبة",
    back: "رجوع",
    save: "حفظ والمتابعة",
    saving: "جاري الحفظ...",
    saveError: "تعذر حفظ بيانات المحل",
  },
  en: {
    bizData: "Business Setup",
    subtitle: "Two quick steps and you're ready to track your business",
    step: (n: number) => `Step ${n} of ${STEPS}`,
    bizInfo: "Business Info",
    bizName: "Business name",
    bizNamePlaceholder: "e.g. The Sweet House",
    bizNameRequired: "Please enter your business name",
    city: "City",
    cityOptional: "(optional)",
    cityPlaceholder: "e.g. Riyadh",
    next: "Next",
    vatSettings: "Tax Settings",
    vatQuestion: "Registered for VAT?",
    vatNumber: "VAT number",
    vatNumberPlaceholder: "3xxxxxxxxxxxxx03",
    vatRequired: "Enter your VAT number or disable VAT",
    back: "Back",
    save: "Save & Continue",
    saving: "Saving...",
    saveError: "Could not save business details",
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const tx = t[language];

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatNumber, setVatNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  function handleNextStep(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(tx.bizNameRequired);
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (vatEnabled && !vatNumber.trim()) {
      setError(tx.vatRequired);
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
      setError(err instanceof ApiError ? err.message : tx.saveError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f8f7]" dir={language === "ar" ? "rtl" : "ltr"}>

      {/* Language toggle */}
      <button
        type="button"
        onClick={toggleLanguage}
        className="absolute end-4 top-4 z-20 flex h-10 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-bold text-gray-600 shadow-sm ring-1 ring-gray-100"
        aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        {language === "ar" ? "EN" : "عربي"}
      </button>

      {/* Background blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-6 h-60 w-60 -translate-x-1/2 animate-blob bg-brand-100 opacity-70" />
        <div
          className="absolute left-[30%] top-20 h-36 w-36 animate-blob bg-brand-200 opacity-40"
          style={{ animationDelay: "3s", animationDuration: "11s" }}
        />
        <div className="absolute left-1/2 top-8 h-52 w-52 -translate-x-1/2 animate-spin-slow rounded-full border-2 border-brand-200 opacity-30" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col px-6 py-12">

        {/* Logo + heading */}
        <div className="mb-8 flex animate-fade-up flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-brand-700 text-3xl font-extrabold text-white shadow-sm">
            {language === "ar" ? "د" : "D"}
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900">{tx.bizData}</h1>
          <p className="text-sm text-gray-500">{tx.subtitle}</p>
        </div>

        {/* Step progress */}
        <div className="mb-6 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">{tx.step(step)}</span>
            <span className="text-xs font-semibold text-brand-700">
              {step === 1 ? tx.bizInfo : tx.vatSettings}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-brand-700 transition-all duration-500"
              style={{ width: `${(step / STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div
          className="animate-slide-up rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
          style={{ animationDelay: "120ms" }}
          key={step}
        >
          {step === 1 ? (
            <form onSubmit={handleNextStep} className="flex flex-col gap-4">
              {/* Business name */}
              <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
                <label htmlFor="biz-name" className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Building2 className="h-4 w-4 text-brand-600" />
                  {tx.bizName}
                </label>
                <input
                  id="biz-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tx.bizNamePlaceholder}
                  autoFocus
                  className={cn(fieldClass, "py-3.5")}
                />
              </div>

              {/* City */}
              <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
                <label htmlFor="biz-city" className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <MapPin className="h-4 w-4 text-brand-600" />
                  {tx.city}{" "}
                  <span className="font-normal text-gray-400">{tx.cityOptional}</span>
                </label>
                <input
                  id="biz-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={tx.cityPlaceholder}
                  className={cn(fieldClass, "py-3.5")}
                />
              </div>

              {error && (
                <p className="animate-scale-in rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800"
              >
                {tx.next}
                {language === "ar" ? (
                  <ChevronLeft className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* VAT toggle */}
              <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Receipt className="h-4 w-4 text-brand-600" />
                  {tx.vatQuestion}
                </label>
                <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5">
                  <span className="text-sm font-medium text-gray-600">
                    {vatEnabled
                      ? language === "ar" ? "مفعّل" : "Enabled"
                      : language === "ar" ? "غير مفعّل" : "Disabled"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={vatEnabled}
                    onClick={() => {
                      setVatEnabled((v) => !v);
                      setError(null);
                    }}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
                      vatEnabled ? "bg-brand-700" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                        language === "ar"
                          ? vatEnabled ? "right-1" : "right-6"
                          : vatEnabled ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* VAT number (conditional) */}
              {vatEnabled && (
                <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
                  <label htmlFor="biz-vat" className="mb-1.5 block text-sm font-semibold text-gray-700">
                    {tx.vatNumber}
                  </label>
                  <input
                    id="biz-vat"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    dir="ltr"
                    placeholder={tx.vatNumberPlaceholder}
                    autoFocus
                    className={cn(fieldClass, "py-3.5 text-left")}
                  />
                </div>
              )}

              {error && (
                <p className="animate-scale-in rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
                  {error}
                </p>
              )}

              <div className="mt-1 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(null); }}
                  className="flex w-14 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white py-3.5 text-gray-600 transition-all active:scale-[0.98] active:bg-gray-50"
                  aria-label={tx.back}
                >
                  {language === "ar" ? (
                    <ChevronRight className="h-5 w-5" />
                  ) : (
                    <ChevronLeft className="h-5 w-5" />
                  )}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800 disabled:opacity-60"
                >
                  {loading ? tx.saving : tx.save}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
