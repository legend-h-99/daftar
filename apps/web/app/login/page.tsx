"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages, Phone, Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";
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

type AuthTab = "phone" | "email";
type EmailMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();

  // Phone tab state
  const [phone, setPhone]     = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Email tab state
  const [tab, setTab] = useState<AuthTab>("email");
  const [emailMode, setEmailMode] = useState<EmailMode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const isPhoneValid = /^05\d{8}$/.test(phone);

  function handlePhoneChange(value: string) {
    setPhone(value.replace(/\D/g, "").slice(0, 10));
    if (phoneError) setPhoneError(null);
  }

  async function enterDemo(phoneNumber: string) {
    if (!DEMO_MODE) {
      if (!SERVER_DEMO_LOGIN) {
        setPhone(phoneNumber);
        setTab("phone");
        return;
      }
      setPhoneError(null);
      setPhoneLoading(true);
      try {
        const res = await apiPost<{ accessToken: string; hasBusiness: boolean }>(
          "/auth/demo",
          { phone: phoneNumber },
        );
        setToken(res.accessToken);
        router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
      } catch (err) {
        setPhoneError(err instanceof ApiError ? err.message : language === "ar" ? "تعذر دخول الحساب التجريبي" : "Could not sign in to demo account");
      } finally {
        setPhoneLoading(false);
      }
      return;
    }
    setToken(DEMO_TOKEN);
    router.replace("/dashboard");
  }

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isPhoneValid) {
      setPhoneError(language === "ar" ? "رقم الجوال غير صحيح، تأكد إنه يبدأ بـ 05 ومكوّن من 10 أرقام" : "Enter a valid Saudi mobile number starting with 05.");
      return;
    }
    setPhoneError(null);
    setPhoneLoading(true);
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
      setPhoneError(
        err instanceof ApiError
          ? err.message
          : language === "ar" ? "تعذر إرسال رمز التحقق، حاول مرة أخرى" : "Could not send the verification code. Please try again.",
      );
    } finally {
      setPhoneLoading(false);
    }
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
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f7f8f7] px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-brand-100 bg-brand-50/70" />
        <div className="relative z-10 w-full max-w-sm animate-slide-up rounded-2xl border border-gray-100 bg-white p-8 shadow-sm text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-extrabold text-gray-900">تم التسجيل بنجاح!</h2>
          <p className="mt-3 text-sm text-gray-500">
            أرسلنا رابط تأكيد إلى <strong className="text-gray-700">{email}</strong>.
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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f8f7]" dir={language === "ar" ? "rtl" : "ltr"}>
      <button
        type="button"
        onClick={toggleLanguage}
        className="absolute end-4 top-4 z-20 flex h-10 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-bold text-gray-600 shadow-sm ring-1 ring-gray-100"
        aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      >
        <Languages className="h-4 w-4" />
        {language === "ar" ? "EN" : "عربي"}
      </button>

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 border-b border-brand-100 bg-brand-50/70" />

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col px-6 py-12">

        {/* Logo */}
        <div className="mb-8 flex animate-fade-up flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-700 text-3xl font-extrabold text-white shadow-sm">
            {language === "ar" ? "د" : "D"}
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900">
            {language === "ar" ? "دفتر" : "Daftar"}
          </h1>
          <p className="text-sm text-gray-500">
            {language === "ar"
              ? "سجّل دخولك وتابع حسابات محلك بكل سهولة"
              : "Sign in and keep your business accounts in one place."}
          </p>
        </div>

        {/* Card */}
        <div
          className="motion-surface animate-slide-up rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
          style={{ animationDelay: "120ms" }}
        >
          {/* Google */}
          <div className="p-6 pb-4">
            <GoogleSignInButton />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-6 pb-4">
            <span className="h-px flex-1 bg-gray-100" />
            <span className="text-xs font-semibold text-gray-400">
              {language === "ar" ? "أو" : "or"}
            </span>
            <span className="h-px flex-1 bg-gray-100" />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 mx-6">
            <button
              type="button"
              onClick={() => setTab("email")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold border-b-2 transition-colors",
                tab === "email"
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-400 hover:text-gray-600",
              )}
            >
              <Mail className="h-4 w-4" />
              {language === "ar" ? "البريد الإلكتروني" : "Email"}
            </button>
            <button
              type="button"
              onClick={() => setTab("phone")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold border-b-2 transition-colors",
                tab === "phone"
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-400 hover:text-gray-600",
              )}
            >
              <Phone className="h-4 w-4" />
              {language === "ar" ? "رقم الجوال" : "Phone"}
            </button>
          </div>

          <div className="p-6 pt-5">
            {/* ── Email tab ── */}
            {tab === "email" && (
              <>
                {/* Login/Register toggle */}
                <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
                  <button
                    type="button"
                    onClick={() => { setEmailMode("login"); setEmailError(null); }}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-xs font-bold transition-all",
                      emailMode === "login"
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500",
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
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500",
                    )}
                  >
                    {language === "ar" ? "حساب جديد" : "Sign up"}
                  </button>
                </div>

                <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                  {emailMode === "register" && (
                    <div>
                      <label htmlFor="name" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-gray-600">
                        <User className="h-3.5 w-3.5 text-brand-600" />
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
                    <label htmlFor="email" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <Mail className="h-3.5 w-3.5 text-brand-600" />
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
                    <label htmlFor="password" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <Lock className="h-3.5 w-3.5 text-brand-600" />
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
                        className="absolute inset-y-0 end-3 flex items-center text-gray-400"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {emailError && (
                    <p className="animate-scale-in rounded-xl bg-red-50 px-3 py-2.5 text-center text-sm font-medium text-red-600">
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
              </>
            )}

            {/* ── Phone tab ── */}
            {tab === "phone" && (
              <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="phone" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <Phone className="h-3.5 w-3.5 text-brand-600" />
                    {language === "ar" ? "رقم الجوال" : "Mobile number"}
                  </label>
                  <input
                    id="phone"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    inputMode="numeric"
                    autoComplete="tel"
                    dir="ltr"
                    placeholder="05xxxxxxxx"
                    className={cn(fieldClass, "py-3 text-left font-semibold tabular-nums")}
                  />
                </div>

                {phoneError && (
                  <p className="animate-scale-in rounded-xl bg-red-50 px-3 py-2.5 text-center text-sm font-medium text-red-600">
                    {phoneError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={phoneLoading}
                  className="motion-press w-full rounded-2xl bg-brand-700 py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-brand-800 disabled:opacity-60"
                >
                  {phoneLoading
                    ? (language === "ar" ? "جاري الإرسال..." : "Sending...")
                    : (language === "ar" ? "إرسال رمز التحقق" : "Send verification code")}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Demo entry */}
        <div className="animate-fade-up mt-5" style={{ animationDelay: "260ms" }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400">
              {language === "ar" ? "أو جرّب مباشرة" : "or try a demo"}
            </span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>
          <button
            type="button"
            disabled={phoneLoading || emailLoading}
            onClick={() => {
              const store = DEMO_STORES[Math.floor(Math.random() * DEMO_STORES.length)];
              enterDemo(store.phone);
            }}
            className="motion-press w-full rounded-2xl border border-brand-200 bg-brand-50 py-3 text-sm font-semibold text-brand-700 transition-all active:scale-[0.98] active:bg-brand-100 disabled:opacity-60"
          >
            {phoneLoading
              ? (language === "ar" ? "جاري الدخول..." : "Signing in...")
              : (language === "ar" ? "دخول تجريبي" : "Try demo")}
          </button>
        </div>
      </div>
    </main>
  );
}
