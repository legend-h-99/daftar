"use client";

import BehaviorAnalytics from "@/components/BehaviorAnalytics";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useBusiness } from "@/lib/business-context";
import { useLanguage } from "@/lib/language";
import { formatDate } from "@/lib/format";
import { fieldClass } from "@/components/ui/form-field";

interface Overview {
  users: number;
  businesses: number;
  onboardedUsers: number;
  googleUsers: number;
  unverifiedEmailUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  signupsByDay: { day: string; count: number }[];
  activeBusinesses7d: number;
  invoices: number;
  invoices7d: number;
  errors24h: number;
  errorsByPath: { method: string; path: string; status: number; count: number; lastAt: string }[];
  recentAdminActions: { action: string; result: string; targetEmail: string | null; createdAt: string }[];
}

interface FoundUser {
  id: string;
  name?: string | null;
  email?: string | null;
  createdAt: string;
  emailVerified: boolean;
  google: boolean;
  hasPassword: boolean;
  businessName?: string | null;
  invoiceCount: number;
  lastInvoiceAt?: string | null;
}

type LinkKind = "verification-email" | "password-reset";

const ACTION_LABELS: Record<string, { ar: string; en: string }> = {
  VERIFICATION_LINK: { ar: "رابط تأكيد البريد", en: "Verification link" },
  PASSWORD_RESET_LINK: { ar: "رابط تغيير كلمة المرور", en: "Password reset link" },
};

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "red" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${tone === "red" && value > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useBusiness();
  const { language } = useLanguage();
  const en = language === "en";
  const isAdmin = user?.isAdmin === true;

  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadOverview = useCallback(() => {
    apiGet<Overview>("/admin/overview")
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiError ? err.message : en ? "Could not load the overview" : "تعذر تحميل نظرة المنصة"));
  }, [en]);

  useEffect(() => {
    if (isAdmin) loadOverview();
  }, [isAdmin, loadOverview]);

  if (!isAdmin) {
    return (
      <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        {en ? "This page is not available" : "هذه الصفحة غير متاحة"}
      </p>
    );
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setNotice(null);
    try {
      setResults(await apiGet<FoundUser[]>(`/admin/users?q=${encodeURIComponent(q)}`));
    } catch (err) {
      setNotice({ ok: false, text: err instanceof ApiError ? err.message : en ? "Search failed" : "تعذر البحث" });
    } finally {
      setSearching(false);
    }
  }

  // Sending needs a second tap, like deleting elsewhere in the app.
  async function sendLink(target: FoundUser, kind: LinkKind) {
    const key = `${target.id}:${kind}`;
    if (confirming !== key) {
      setConfirming(key);
      return;
    }
    setConfirming(null);
    setSending(key);
    setNotice(null);
    try {
      await apiPost(`/admin/users/${target.id}/${kind}`, {});
      setNotice({ ok: true, text: en ? `Link sent to ${target.email}` : `تم إرسال الرابط إلى ${target.email}` });
      loadOverview();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof ApiError ? err.message : en ? "Could not send" : "تعذر الإرسال" });
    } finally {
      setSending(null);
    }
  }

  const firstName = (user?.name ?? "").split(" ")[0];
  const maxSignups = Math.max(1, ...(overview?.signupsByDay ?? []).map((d) => d.count));

  function linkButton(target: FoundUser, kind: LinkKind, label: string) {
    const key = `${target.id}:${kind}`;
    const confirmLabel = en ? "Tap again to send" : "اضغط مرة ثانية للإرسال";
    return (
      <button
        type="button"
        onClick={() => sendLink(target, kind)}
        disabled={sending !== null}
        className={`rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
          confirming === key ? "border-amber-400 bg-amber-50 text-amber-800" : "border-brand-200 text-brand-700"
        }`}
      >
        {sending === key ? (en ? "Sending..." : "جاري الإرسال...") : confirming === key ? confirmLabel : label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-foreground">{en ? "Platform admin" : "إدارة المنصة"}</h1>
        {firstName && <p className="text-sm text-muted-foreground">{en ? `Welcome ${firstName}` : `أهلاً ${firstName}`}</p>}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

      <BehaviorAnalytics en={en} />

      {overview && (
        <>
          <section className="grid grid-cols-2 gap-2">
            <Stat label={en ? "Users" : "المستخدمون"} value={overview.users} />
            <Stat label={en ? "Shops" : "المحلات"} value={overview.businesses} />
            <Stat label={en ? "New users (7 days)" : "مستخدمون جدد (7 أيام)"} value={overview.newUsers7d} />
            <Stat label={en ? "Active shops (7 days)" : "محلات نشطة (7 أيام)"} value={overview.activeBusinesses7d} />
            <Stat label={en ? "Invoices (7 days)" : "فواتير (7 أيام)"} value={overview.invoices7d} />
            <Stat label={en ? "Server errors (24 h)" : "أخطاء الخادم (24 ساعة)"} value={overview.errors24h} tone="red" />
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-bold text-foreground">{en ? "Sign-ups, last 14 days" : "التسجيلات آخر 14 يوماً"}</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {en
                ? `${overview.onboardedUsers} finished onboarding · ${overview.googleUsers} use Google · ${overview.unverifiedEmailUsers} email not verified`
                : `${overview.onboardedUsers} أكملوا التسجيل · ${overview.googleUsers} بحساب Google · ${overview.unverifiedEmailUsers} بريدهم غير مؤكد`}
            </p>
            <div className="flex h-24 items-end gap-1" role="img" aria-label={en ? "Daily sign-ups" : "التسجيلات اليومية"}>
              {overview.signupsByDay.map((d) => (
                <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.day}: ${d.count}`}>
                  <div className="w-full rounded-t bg-brand-500" style={{ height: `${(d.count / maxSignups) * 100}%`, minHeight: d.count ? 4 : 1 }} />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-foreground">{en ? "Server errors, last 24 hours" : "أخطاء الخادم آخر 24 ساعة"}</h2>
            {overview.errorsByPath.length === 0 ? (
              <p className="text-sm text-muted-foreground">{en ? "No errors" : "لا توجد أخطاء"}</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {overview.errorsByPath.map((e) => (
                  <li key={`${e.method}${e.path}${e.status}`} className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs text-foreground" dir="ltr">
                      <span className="text-muted-foreground">{e.method} </span>{e.path}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{e.status} × {e.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-foreground">{en ? "Support" : "الدعم الفني"}</h2>
        <form onSubmit={search} className="flex gap-2">
          <input
            aria-label={en ? "Search by email or shop name" : "ابحث بالبريد أو اسم المحل"}
            placeholder={en ? "Email, name or shop" : "البريد أو الاسم أو المحل"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="shrink-0 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {en ? "Search" : "بحث"}
          </button>
        </form>

        {notice && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${notice.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {notice.text}
          </p>
        )}

        {results && (
          results.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{en ? "No users found" : "لا يوجد مستخدم مطابق"}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {results.map((u) => (
                <li key={u.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-bold text-foreground">{u.name || (en ? "No name" : "بدون اسم")}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{u.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      u.businessName ? (en ? `Shop: ${u.businessName}` : `المحل: ${u.businessName}`) : en ? "No shop yet" : "لم يكمل التسجيل",
                      u.google ? "Google" : en ? "Email & password" : "بريد وكلمة مرور",
                      u.hasPassword && !u.emailVerified ? (en ? "Email not verified" : "البريد غير مؤكد") : null,
                      en ? `${u.invoiceCount} invoices` : `${u.invoiceCount} فاتورة`,
                      en ? `Joined ${formatDate(u.createdAt)}` : `سجّل ${formatDate(u.createdAt)}`,
                    ].filter(Boolean).join(" · ")}
                  </p>
                  {u.email && u.hasPassword && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!u.emailVerified && linkButton(u, "verification-email", en ? "Send verification link" : "إرسال رابط تأكيد البريد")}
                      {linkButton(u, "password-reset", en ? "Send password reset link" : "إرسال رابط تغيير كلمة المرور")}
                    </div>
                  )}
                  {!u.hasPassword && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {en ? "Signs in with Google; no links needed." : "يدخل بحساب Google، لا يحتاج روابط."}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
      </section>

      {overview && overview.recentAdminActions.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-foreground">{en ? "Recent support actions" : "آخر إجراءات الدعم"}</h2>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {overview.recentAdminActions.map((a, i) => (
              <li key={i}>
                {ACTION_LABELS[a.action]?.[en ? "en" : "ar"] ?? a.action} → <span dir="ltr">{a.targetEmail ?? "—"}</span>
                {" · "}{a.result === "SENT" ? (en ? "sent" : "أُرسل") : (en ? "failed" : "فشل")}{" · "}{formatDate(a.createdAt)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
