"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/language";

export default function EmailAuthGate({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  if (process.env.NEXT_PUBLIC_EMAIL_LOGIN_ENABLED === "true") return <>{children}</>;
  const en = language === "en";
  return (
    <main dir={en ? "ltr" : "rtl"} className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-bold">{en ? "Sign in with Google" : "سجّل الدخول باستخدام Google"}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {en ? "Email sign-in and password recovery are currently unavailable." : "الدخول بالبريد الإلكتروني واستعادة كلمة المرور غير متاحين حاليًا."}
        </p>
        <Link href="/login" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 font-bold text-primary-foreground">
          {en ? "Back to sign in" : "العودة لتسجيل الدخول"}
        </Link>
      </div>
    </main>
  );
}
