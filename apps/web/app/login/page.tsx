"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages, Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { DEMO_MODE, DEMO_TOKEN } from "@/lib/demo-api";
import { setToken } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";

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

type EmailMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();

  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  const [emailMode, setEmailMode] = useState<EmailMode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  async function enterDemo(phoneNumber: string) {
    if (!DEMO_MODE) {
      if (!SERVER_DEMO_LOGIN) {
        return;
      }
      setDemoError(null);
      setDemoLoading(true);
      try {
        const res = await apiPost<{ accessToken: string; hasBusiness: boolean }>(
          "/auth/demo",
          { phone: phoneNumber },
        );
        setToken(res.accessToken);
        router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
      } catch (err) {
        setDemoError(err instanceof ApiError ? err.message : language === "ar" ? "تعذر دخول الحساب التجريبي" : "Could not sign in to demo account");
      } finally {
        setDemoLoading(false);
      }
      return;
    }
    setToken(DEMO_TOKEN);
    router.replace("/dashboard");
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailLoading(true);
    try {
      if (emailMode === "register") {
        await apiPost("/auth/email/register", { email, password, name: name || undefined });
        setRegisterSuccess(true);
      } else {
        const res = await apiPost<{
          accessToken: string;
          hasBusiness: boolean;
        }>("/auth/email/login", { email, password });
        setToken(res.accessToken);
        router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
      }
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : "حدث خطأ، حاول مرة أخرى");
    } finally {
      setEmailLoading(false);
    }
  }

  if (registerSuccess) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background text-foreground px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-border bg-accent/40" />
        <div className="relative z-10 w-full max-w-sm animate-slide-up rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600 dark:text-green-400" />
          <h2 className="text-xl font-extrabold text-foreground">تم التسجيل بنجاح!</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            أرسلنا رابط تأكيد إلى <strong className="text-foreground">{email}</strong>.
            <br />
            تحقق من صندوق الوارد وانقر على الرابط لتفعيل حسابك.
          </p>
          <button
            onClick={() => { setRegisterSuccess(false); setEmailMode("login"); }}
            className="mt-6 w-full rounded-2xl bg-brand-700 py-3 text-sm font-bold text-white"
          >
            تسجيل الدخول
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground" dir={language === "ar" ? "rtl" : "ltr"}>
      <button
        type="button"
        onClick={toggleLanguage}
        className="absolute end-4 top-4 z-20 flex h-10 items-center gap-1.5 rounded-full bg-card/90 px-3 text-xs font-bold text-muted-foreground shadow-sm ring-1 ring-border"
        aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      >
        <Languages className="h-4 w-4" />
        {language === "ar" ? "EN" : "عربي"}
      </button>

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-border bg-accent/40" />

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col px-6 py-12">

        {/* Logo */}
        <div className="mb-8 flex animate-fade-up flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-700 text-3xl font-extrabold text-white shadow-sm">
            {language === "ar" ? "د" : "D"}
          </span>
          <h1 className="text-2xl font-extrabold text-foreground">
            {language === "ar" ? "دفتر" : "Daftar"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {language === "ar"
              ? "سجّل دخولك وتابع حسابات محلك بكل سهولة"
              : "Sign in and keep your business accounts in one place."}
          </p>
        </div>

        {/* Card */}
        <div
          className="motion-surface animate-slide-up rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
          style={{ animationDelay: "120ms" }}
        >
          {/* Google */}
          <div className="p-6 pb-4">
            <GoogleSignInButton />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-6 pb-4">
            <span className="h-px flex-1 bg-muted" />
            <span className="text-xs font-semibold text-muted-foreground">
              {language === "ar" ? "أو" : "or"}
            </span>
            <span className="h-px flex-1 bg-muted" />
          </div>

          <div className="p-6 pt-5">
            {/* Login/Register toggle */}
            <div className="flex rounded-xl bg-muted p-1 mb-5">
              <button
                type="button"
                onClick={() => { setEmailMode("login"); setEmailError(null); }}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-bold transition-all",
                  emailMode === "login"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {language === "ar" ? "تسجيل دخول" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setEmailMode("register"); setEmailError(null); }}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-bold transition-all",
                  emailMode === "register"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {language === "ar" ? "حساب جديد" : "Sign up"}
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
              {emailMode === "register" && (
                <div>
                  <label htmlFor="name" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {language === "ar" ? "الاسم (اختياري)" : "Name (optional)"}
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder={language === "ar" ? "اسمك" : "Your name"}
                    className={cn(fieldClass, "py-3")}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  {language === "ar" ? "البريد الإلكتروني" : "Email"}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                  autoComplete="email"
                  inputMode="email"
                  dir="ltr"
                  placeholder="you@example.com"
                  className={cn(fieldClass, "py-3 text-left")}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  {language === "ar" ? "كلمة المرور" : "Password"}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setEmailError(null); }}
                    autoComplete={emailMode === "register" ? "new-password" : "current-password"}
                    dir="ltr"
                    placeholder={emailMode === "register" ? "8 أحرف على الأقل" : "••••••••"}
                    className={cn(fieldClass, "py-3 text-left pe-10")}
                    minLength={emailMode === "register" ? 8 : undefined}
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 end-3 flex items-center text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {emailError && (
                <p className="animate-scale-in rounded-xl bg-red-50 dark:bg-red-950 px-3 py-2.5 text-center text-sm font-medium text-red-600 dark:text-red-300">
                  {emailError}
                </p>
              )}

              <button
                type="submit"
                disabled={emailLoading}
                className="motion-press mt-1 w-full rounded-2xl bg-brand-700 py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800 disabled:opacity-60"
              >
                {emailLoading
                  ? (language === "ar" ? "جاري..." : "Loading...")
                  : emailMode === "login"
                    ? (language === "ar" ? "تسجيل الدخول" : "Sign in")
                    : (language === "ar" ? "إنشاء الحساب" : "Create account")}
              </button>
            </form>
          </div>
        </div>

        {/* Demo entry */}
        {(DEMO_MODE || SERVER_DEMO_LOGIN) && (
          <div className="animate-fade-up mt-5" style={{ animationDelay: "260ms" }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground">
                {language === "ar" ? "أو جرّب مباشرة" : "or try a demo"}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {demoError && (
              <p role="alert" className="mb-3 rounded-xl bg-red-50 dark:bg-red-950 px-3 py-2.5 text-center text-sm font-medium text-red-600 dark:text-red-300">
                {demoError}
              </p>
          )}
          <button
            type="button"
            disabled={demoLoading || emailLoading}
            onClick={() => {
              const store = DEMO_STORES[Math.floor(Math.random() * DEMO_STORES.length)];
              enterDemo(store.phone);
            }}
            className="motion-press w-full rounded-2xl border border-border bg-accent py-3 text-sm font-semibold text-primary transition-all active:scale-[0.98] active:bg-brand-100 disabled:opacity-60"
          >
            {demoLoading
              ? (language === "ar" ? "جاري الدخول..." : "Signing in...")
              : (language === "ar" ? "دخول تجريبي" : "Try demo")}
          </button>
        </div>
        )}
      </div>
    </main>
  );
}
