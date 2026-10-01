"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Languages, Mail, Lock, User, Eye, EyeOff, CheckCircle2, Smartphone } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { DEMO_MODE, DEMO_TOKEN } from "@/lib/demo-api";
import { setToken } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";

const SERVER_DEMO_LOGIN = process.env.NEXT_PUBLIC_DEMO_LOGIN === "true";
// Keep the UI hidden until a real SMS provider is enabled in Supabase Auth.
const PHONE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_PHONE_LOGIN_ENABLED === "true";

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
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

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
          { auth: false },
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

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    setPhoneError(null);

    const digits = phone.replace(/\D/g, "");
    const localDigits = digits.startsWith("966") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
    if (!/^5\d{8}$/.test(localDigits)) {
      setPhoneError(language === "ar" ? "أدخل رقم جوال سعودي صحيحًا، مثل 05xxxxxxxx" : "Enter a valid Saudi mobile number, e.g. 05xxxxxxxx");
      return;
    }

    const normalizedPhone = `+966${localDigits}`;
    setPhoneLoading(true);
    try {
      const result = await apiPost<{ sent: boolean; devCode?: string }>(
        "/auth/otp/request", { phone: normalizedPhone }, { auth: false },
      );
      sessionStorage.setItem("daftar_otp_flow", JSON.stringify({
        phone: normalizedPhone,
        devCode: result.devCode ?? "",
      }));
      router.replace("/otp");
    } catch (err) {
      setPhoneError(err instanceof ApiError && err.status === 503
        ? language === "ar"
          ? "الدخول بالجوال غير مفعّل بعد. يلزم إعداد مزود رسائل SMS أولًا."
          : "Phone sign-in is not enabled yet. An SMS provider must be configured first."
        : err instanceof ApiError
          ? err.message
          : language === "ar" ? "تعذر إرسال رمز التحقق، حاول مرة أخرى" : "Could not send the verification code. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);

    if (emailMode === "register" && password.length < 8) {
      setEmailError(
        language === "ar"
          ? "كلمة المرور لازم تكون 8 أحرف على الأقل"
          : "Password must be at least 8 characters",
      );
      return;
    }

    setEmailLoading(true);
    try {
      if (emailMode === "register") {
        await apiPost("/auth/email/register", { email, password, name: name || undefined }, { auth: false });
        setRegisterSuccess(true);
      } else {
        const res = await apiPost<{
          accessToken: string;
          hasBusiness: boolean;
        }>("/auth/email/login", { email, password }, { auth: false });
        setToken(res.accessToken);
        router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
      }
    } catch (err) {
      setEmailError(
        err instanceof ApiError
          ? err.message
          : language === "ar" ? "حدث خطأ، حاول مرة أخرى" : "Something went wrong, please try again",
      );
    } finally {
      setEmailLoading(false);
    }
  }

  if (registerSuccess) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background text-foreground px-6" dir={language === "ar" ? "rtl" : "ltr"}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-border bg-accent/40" />
        <div className="relative z-10 w-full max-w-sm animate-slide-up rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600 dark:text-green-400" />
          <h2 className="text-xl font-extrabold text-foreground">
            {language === "ar" ? "تم التسجيل بنجاح!" : "Registration successful!"}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {language === "ar" ? (
              <>
                أرسلنا رابط تأكيد إلى <strong className="text-foreground">{email}</strong>.
                <br />
                تحقق من صندوق الوارد وانقر على الرابط لتفعيل حسابك.
              </>
            ) : (
              <>
                We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
                <br />
                Check your inbox and click the link to activate your account.
              </>
            )}
          </p>
          <button
            onClick={() => { setRegisterSuccess(false); setEmailMode("login"); }}
            className="mt-6 w-full rounded-2xl bg-brand-700 py-3 text-sm font-bold text-white"
          >
            {language === "ar" ? "تسجيل الدخول" : "Sign in"}
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

          {PHONE_LOGIN_ENABLED && <form onSubmit={handlePhoneSubmit} className="px-6 pb-5">
            <label htmlFor="phone" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5 text-primary" />
              {language === "ar" ? "الدخول برقم الجوال" : "Sign in with mobile"}
            </label>
            <div className="flex gap-2" dir="ltr">
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneError(null); }}
                autoComplete="tel"
                inputMode="tel"
                placeholder="05xxxxxxxx"
                className={cn(fieldClass, "min-w-0 flex-1 py-3 text-left")}
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? "phone-error" : undefined}
                required
              />
              <button
                type="submit"
                disabled={phoneLoading || emailLoading}
                className="shrink-0 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {phoneLoading
                  ? (language === "ar" ? "جاري..." : "Sending...")
                  : (language === "ar" ? "إرسال الرمز" : "Send code")}
              </button>
            </div>
            {phoneError && (
              <p id="phone-error" role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-600 dark:bg-red-950 dark:text-red-300">
                {phoneError}
              </p>
            )}
          </form>}

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
                    placeholder={
                      emailMode === "register"
                        ? language === "ar" ? "8 أحرف على الأقل" : "At least 8 characters"
                        : "••••••••"
                    }
                    className={cn(fieldClass, "py-3 text-left pr-11")}
                    minLength={emailMode === "register" ? 8 : undefined}
                    required
                  />
                  <button
                    type="button"
                    aria-label={language === "ar" ? (showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور") : (showPassword ? "Hide password" : "Show password")}
                    aria-pressed={showPassword}
                    aria-controls="password"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-lg text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {emailMode === "login" && (
                  <Link
                    href="/forgot-password"
                    className="mt-1.5 flex min-h-6 items-center justify-end text-xs font-semibold text-primary underline underline-offset-4"
                  >
                    {language === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                  </Link>
                )}
              </div>

              {emailError && (
                <p role="alert" className="animate-scale-in rounded-xl bg-red-50 dark:bg-red-950 px-3 py-2.5 text-center text-sm font-medium text-red-600 dark:text-red-300">
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
            <Link href="/privacy" className="mt-4 flex min-h-11 items-center justify-center rounded-lg text-sm text-primary underline underline-offset-4">
              {language === "ar" ? "إشعار الخصوصية" : "Privacy notice"}
            </Link>
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
