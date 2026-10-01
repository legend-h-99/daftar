"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language";
import AuthBrand from "@/components/AuthBrand";

export default function NotFound() {
  const { language } = useLanguage();

  return (
    <main
      className="relative flex min-h-screen flex-col items-center overflow-hidden bg-background px-6 py-12 text-foreground"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-border bg-accent/40" />

      <div className="relative z-10">
        <AuthBrand />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-slide-up rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-5xl font-extrabold text-brand-700">404</p>
        <h1 className="mt-4 text-xl font-extrabold text-foreground">
          {language === "ar" ? "الصفحة غير موجودة" : "Page not found"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {language === "ar"
            ? "يمكن الرابط قديم أو فيه خطأ. ارجع للرئيسية وكمّل من هناك."
            : "The link may be outdated or mistyped. Head back home and continue from there."}
        </p>
        <Link
          href="/"
          className="motion-press mt-6 block w-full rounded-2xl bg-brand-700 py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800"
        >
          {language === "ar" ? "الرجوع للرئيسية" : "Back to home"}
        </Link>
      </div>
    </main>
  );
}
