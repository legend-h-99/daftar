"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language";

/** Logo + app name shown above the card on auth pages (sits in the tinted top band). */
export default function AuthBrand() {
  const { language } = useLanguage();

  return (
    <Link href="/" className="mb-8 flex animate-fade-up flex-col items-center gap-3 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-700 text-3xl font-extrabold text-white shadow-sm">
        {language === "ar" ? "د" : "D"}
      </span>
      <span className="text-2xl font-extrabold text-foreground">
        {language === "ar" ? "دفتر" : "Daftar"}
      </span>
    </Link>
  );
}
