"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Receipt } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { isAuthenticated, setToken } from "@/lib/auth";
import { Business } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";
import { useLanguage } from "@/lib/language";

import FirstExpensePrompt from "@/components/FirstExpensePrompt";

const t = {
  ar: {
    bizData: "بيانات المحل",
    subtitle: "اكتب اسم محلك وتبدأ تتابع حساباتك",
    bizName: "اسم المحل",
    bizNamePlaceholder: "مثال: بيت الحلا",
    bizNameRequired: "اكتب اسم المحل أولاً",
    city: "المدينة",
    cityOptional: "(اختياري)",
    cityPlaceholder: "مثال: الرياض",
    hasVat: "عندي رقم ضريبي",
    noVat: "ما عندي رقم ضريبي",
    vatNumber: "الرقم الضريبي",
    vatNumberPlaceholder: "3XXXXXXXXXXXXX3",
    vatRequired: "أدخل الرقم الضريبي أو اختر «ما عندي رقم ضريبي»",
    vatInvalid: "الرقم الضريبي يجب أن يكون 15 رقماً يبدأ بـ 3 وينتهي بـ 3",
    save: "حفظ والمتابعة",
    saving: "جاري الحفظ...",
    saveError: "تعذر حفظ بيانات المحل",
  },
  en: {
    bizData: "Business Setup",
    subtitle: "Add your business name and start tracking",
    bizName: "Business name",
    bizNamePlaceholder: "e.g. The Sweet House",
    bizNameRequired: "Please enter your business name",
    city: "City",
    cityOptional: "(optional)",
    cityPlaceholder: "e.g. Riyadh",
    hasVat: "I have a VAT number",
    noVat: "I don't have a VAT number",
    vatNumber: "VAT number",
    vatNumberPlaceholder: "3XXXXXXXXXXXXX3",
    vatRequired: "Enter your VAT number or choose \"I don't have a VAT number\"",
    vatInvalid: "The VAT number must be 15 digits that start and end with 3.",
    save: "Save & Continue",
    saving: "Saving...",
    saveError: "Could not save business details",
  },
};

// Saudi VAT registration numbers are 15 digits that start and end with 3.
const VAT_NUMBER_PATTERN = /^3\d{13}3$/;

function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export default function OnboardingPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const tx = t[language];

  const [setupComplete, setSetupComplete] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatNumber, setVatNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    track("onboarding_started");
    if (!name.trim()) {
      setError(tx.bizNameRequired);
      return;
    }
    track("workflow_started", { workflow: "onboarding" });
    const normalizedVat = toLatinDigits(vatNumber).replace(/\s/g, "");
    if (vatEnabled && !normalizedVat) {
      track("workflow_failed", { workflow: "onboarding", status: 400 });
      setError(tx.vatRequired);
      return;
    }
    if (vatEnabled && !VAT_NUMBER_PATTERN.test(normalizedVat)) {
      track("workflow_failed", { workflow: "onboarding", status: 400 });
      setError(tx.vatInvalid);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{ accessToken?: string; sessionAuthenticated?: boolean; business: Business }>(
        "/onboarding",
        {
          name: name.trim(),
          vatEnabled,
          vatNumber: vatEnabled ? normalizedVat : undefined,
          city: city.trim() || undefined,
        },
      );
      setToken(res.accessToken, res.sessionAuthenticated);
      track("onboarding_completed", { vat_enabled: vatEnabled });
      setSetupComplete(true);
    } catch (err) {
      track("workflow_failed", { workflow: "onboarding", status: err instanceof ApiError ? err.status : 0 });
      setError(err instanceof ApiError ? err.message : tx.saveError);
    } finally {
      setLoading(false);
    }
  }

  if (setupComplete) return <FirstExpensePrompt onContinue={() => router.replace("/dashboard")} />;

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

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-brand-100 bg-brand-50/70" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col px-6 py-12">

        {/* Logo + heading */}
        <div className="mb-8 flex animate-fade-up flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-700 text-3xl font-extrabold text-white shadow-sm">
            {language === "ar" ? "د" : "D"}
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900">{tx.bizData}</h1>
          <p className="text-sm text-gray-500">{tx.subtitle}</p>
        </div>

        {/* Card */}
        <div
          className="motion-surface animate-slide-up rounded-lg border border-gray-100 bg-white p-6 shadow-sm"
          style={{ animationDelay: "120ms" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                <span className="font-normal text-gray-500">{tx.cityOptional}</span>
              </label>
              <input
                id="biz-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={tx.cityPlaceholder}
                className={cn(fieldClass, "py-3.5")}
              />
            </div>

            {/* VAT is opt-in: most home businesses are not registered */}
            <button
              type="button"
              aria-expanded={vatEnabled}
              onClick={() => {
                setVatEnabled((v) => !v);
                setError(null);
              }}
              className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-brand-700"
            >
              <Receipt className="h-4 w-4" />
              {vatEnabled ? tx.noVat : tx.hasVat}
            </button>

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

            <button
              type="submit"
              disabled={loading}
              className="motion-press mt-1 w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800 disabled:opacity-60"
            >
              {loading ? tx.saving : tx.save}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
