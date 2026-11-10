"use client";

import BehaviorAnalytics from "@/components/BehaviorAnalytics";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useBusiness } from "@/lib/business-context";
import { useLanguage } from "@/lib/language";
import { formatDate } from "@/lib/format";
import { fieldClass } from "@/components/ui/form-field";
import {
  Activity, AlertTriangle, BarChart3, Building2, CalendarDays, CheckCircle2,
  Gauge, LifeBuoy, RefreshCw, ReceiptText, Search, ShieldCheck, TrendingUp,
  UserCheck, Users, type LucideIcon,
} from "lucide-react";

interface Overview {
  users: number; businesses: number; onboardedUsers: number; googleUsers: number;
  unverifiedEmailUsers: number; newUsers7d: number; newUsers30d: number;
  signupsByDay: { day: string; count: number }[]; activeBusinesses7d: number;
  invoices: number; invoices7d: number; errors24h: number;
  errorsByPath: { method: string; path: string; status: number; count: number; lastAt: string }[];
  recentAdminActions: { action: string; result: string; targetEmail: string | null; createdAt: string }[];
}

interface FoundUser {
  id: string; name?: string | null; email?: string | null; createdAt: string;
  emailVerified: boolean; google: boolean; hasPassword: boolean;
  businessName?: string | null; invoiceCount: number; lastInvoiceAt?: string | null;
}

type LinkKind = "verification-email" | "password-reset";

const ACTION_LABELS: Record<string, { ar: string; en: string }> = {
  VERIFICATION_LINK: { ar: "رابط تأكيد البريد", en: "Verification link" },
  PASSWORD_RESET_LINK: { ar: "رابط تغيير كلمة المرور", en: "Password reset link" },
};

const percent = (value: number, total: number) => total > 0 ? Math.round((value / total) * 100) : 0;

function KpiCard({ icon: Icon, label, value, detail, tone = "brand" }: {
  icon: LucideIcon; label: string; value: number; detail: string;
  tone?: "brand" | "green" | "amber" | "red";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  };
  return <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black tracking-tight">{value.toLocaleString("en-US")}</p></div><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" aria-hidden="true" /></span></div>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
  </article>;
}

function Panel({ title, description, icon: Icon, action, children, id }: {
  title: string; description?: string; icon: LucideIcon; action?: React.ReactNode;
  children: React.ReactNode; id?: string;
}) {
  return <section id={id} className="scroll-mt-24 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"><Icon className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-extrabold">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}</div></div>{action}</div>
    {children}
  </section>;
}

function LoadingDashboard({ en }: { en: boolean }) {
  return <div role="status" aria-label={en ? "Loading admin dashboard" : "جاري تحميل لوحة الإدارة"} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0,1,2,3].map(i => <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-card" />)}</div><div className="grid gap-4 lg:grid-cols-3"><div className="h-72 animate-pulse rounded-2xl border border-border bg-card lg:col-span-2" /><div className="h-72 animate-pulse rounded-2xl border border-border bg-card" /></div></div>;
}

export default function AdminPage() {
  const { user } = useBusiness();
  const { language } = useLanguage();
  const en = language === "en";
  const isAdmin = user?.isAdmin === true;
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadOverview = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError(null);
    try { setOverview(await apiGet<Overview>("/admin/overview")); }
    catch (err) { setError(err instanceof ApiError ? err.message : en ? "Could not load the overview" : "تعذر تحميل نظرة المنصة"); }
    finally { setRefreshing(false); }
  }, [en]);

  useEffect(() => { if (isAdmin) void loadOverview(); }, [isAdmin, loadOverview]);

  const metrics = useMemo(() => overview ? {
    onboardingRate: percent(overview.onboardedUsers, overview.users),
    activeRate: percent(overview.activeBusinesses7d, overview.businesses),
    googleRate: percent(overview.googleUsers, overview.users),
    avgInvoices: overview.businesses > 0 ? (overview.invoices / overview.businesses).toFixed(1) : "0.0",
  } : null, [overview]);

  if (!isAdmin) return <p className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">{en ? "This page is not available" : "هذه الصفحة غير متاحة"}</p>;

  async function search(e: FormEvent) {
    e.preventDefault(); const q = query.trim(); if (q.length < 2) return;
    setSearching(true); setNotice(null);
    try { setResults(await apiGet<FoundUser[]>(`/admin/users?q=${encodeURIComponent(q)}`)); }
    catch (err) { setNotice({ ok: false, text: err instanceof ApiError ? err.message : en ? "Search failed" : "تعذر البحث" }); }
    finally { setSearching(false); }
  }

  async function sendLink(target: FoundUser, kind: LinkKind) {
    const key = `${target.id}:${kind}`;
    if (confirming !== key) { setConfirming(key); return; }
    setConfirming(null); setSending(key); setNotice(null);
    try { await apiPost(`/admin/users/${target.id}/${kind}`, {}); setNotice({ ok: true, text: en ? `Link sent to ${target.email}` : `تم إرسال الرابط إلى ${target.email}` }); void loadOverview(); }
    catch (err) { setNotice({ ok: false, text: err instanceof ApiError ? err.message : en ? "Could not send" : "تعذر الإرسال" }); }
    finally { setSending(null); }
  }

  function linkButton(target: FoundUser, kind: LinkKind, label: string) {
    const key = `${target.id}:${kind}`;
    return <button type="button" onClick={() => sendLink(target, kind)} disabled={sending !== null} className={`min-h-10 rounded-full border px-3 text-xs font-bold disabled:opacity-50 ${confirming === key ? "border-amber-400 bg-amber-50 text-amber-800" : "border-brand-200 text-brand-700 dark:border-brand-800 dark:text-brand-300"}`}>{sending === key ? (en ? "Sending..." : "جاري الإرسال...") : confirming === key ? (en ? "Tap again to send" : "اضغط مرة ثانية للإرسال") : label}</button>;
  }

  const firstName = (user?.name ?? "").split(" ")[0];
  const maxSignups = Math.max(1, ...(overview?.signupsByDay ?? []).map(day => day.count));
  const alerts = overview ? [
    overview.errors24h > 0 ? { tone: "red", text: en ? `${overview.errors24h} server errors need review` : `${overview.errors24h} أخطاء خادم تحتاج مراجعة` } : null,
    overview.unverifiedEmailUsers > 0 ? { tone: "amber", text: en ? `${overview.unverifiedEmailUsers} accounts await email verification` : `${overview.unverifiedEmailUsers} حسابات بانتظار تأكيد البريد` } : null,
    overview.activeBusinesses7d === 0 ? { tone: "amber", text: en ? "No business activity recorded in the last 7 days" : "لا يوجد نشاط تجاري مسجل خلال آخر 7 أيام" } : null,
  ].filter(Boolean) as { tone: string; text: string }[] : [];

  return <div className="space-y-5">
    <header className="overflow-hidden rounded-2xl bg-gradient-to-l from-brand-950 via-brand-800 to-brand-700 p-5 text-white shadow-lg shadow-brand-950/10 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><div className="mb-3 flex items-center gap-2 text-sm text-brand-100"><ShieldCheck className="h-4 w-4" /> {en ? "Secure admin workspace" : "مساحة الإدارة الآمنة"}</div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{en ? "Platform command center" : "مركز إدارة المنصة"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-brand-100">{firstName && <span>{en ? `Welcome ${firstName}` : `أهلاً ${firstName}`}</span>}{firstName ? ". " : ""}{en ? "Monitor growth, customer activity, system health and support from one place." : "تابع النمو ونشاط العملاء وصحة النظام وعمليات الدعم من مكان واحد."}</p></div><button type="button" onClick={() => void loadOverview(true)} disabled={refreshing} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold backdrop-blur hover:bg-white/15 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {en ? "Refresh" : "تحديث"}</button></div>
      <nav aria-label={en ? "Admin sections" : "أقسام الإدارة"} className="mt-6 flex gap-2 overflow-x-auto pb-1 text-xs font-bold">{[["#growth",en?"Growth":"النمو"],["#health",en?"System health":"صحة النظام"],["#behavior",en?"Behavior":"السلوك"],["#support",en?"Support":"الدعم"]].map(([href,label]) => <a key={href} href={href} className="whitespace-nowrap rounded-full bg-white/10 px-4 py-2 hover:bg-white/20">{label}</a>)}</nav>
    </header>

    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"><span>{error}</span><button onClick={() => void loadOverview()} className="underline">{en ? "Retry" : "إعادة المحاولة"}</button></div>}
    {!overview && !error && <LoadingDashboard en={en} />}

    {overview && metrics && <>
      <section aria-label={en ? "Key metrics" : "المؤشرات الرئيسية"} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} label={en?"Users":"المستخدمون"} value={overview.users} detail={en?`+${overview.newUsers7d} in the last 7 days`:`+${overview.newUsers7d} خلال آخر 7 أيام`} />
        <KpiCard icon={Building2} label={en?"Businesses":"الأنشطة التجارية"} value={overview.businesses} detail={en?`${metrics.onboardingRate}% completed onboarding`:`${metrics.onboardingRate}% أكملوا تهيئة النشاط`} tone="green" />
        <KpiCard icon={Activity} label={en?"Active businesses":"الأنشطة النشطة"} value={overview.activeBusinesses7d} detail={en?`${metrics.activeRate}% active in the last 7 days`:`${metrics.activeRate}% نشطة خلال آخر 7 أيام`} tone={overview.activeBusinesses7d?"green":"amber"} />
        <KpiCard icon={ReceiptText} label={en?"Total invoices":"إجمالي الفواتير"} value={overview.invoices} detail={en?`${overview.invoices7d} this week · ${metrics.avgInvoices} per business`:`${overview.invoices7d} هذا الأسبوع · ${metrics.avgInvoices} لكل نشاط`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><Panel id="growth" title={en?"User growth":"نمو المستخدمين"} description={en?"Daily registrations during the last 14 days":"التسجيلات اليومية خلال آخر 14 يومًا"} icon={TrendingUp}>
          <div className="flex h-52 items-end gap-1.5 border-b border-border pt-4" role="img" aria-label={en?"Daily sign-ups":"التسجيلات اليومية"}>{overview.signupsByDay.map((day,index) => <div key={day.day} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${day.day}: ${day.count}`}>{day.count>0&&<span className="text-xs font-bold text-brand-700 dark:text-brand-300">{day.count}</span>}<div className="w-full rounded-t-md bg-brand-500 group-hover:bg-brand-700" style={{height:`${Math.max(2,(day.count/maxSignups)*88)}%`}} />{(index===0||index===overview.signupsByDay.length-1)&&<span className="whitespace-nowrap text-xs text-muted-foreground">{day.day.slice(5)}</span>}</div>)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{en?"Last 7 days":"آخر 7 أيام"}</p><p className="mt-1 text-xl font-black">{overview.newUsers7d}</p></div><div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{en?"Last 30 days":"آخر 30 يومًا"}</p><p className="mt-1 text-xl font-black">{overview.newUsers30d}</p></div></div>
        </Panel></div>
        <Panel title={en?"Activation":"التفعيل"} description={en?"Account readiness and sign-in mix":"جاهزية الحسابات وطرق تسجيل الدخول"} icon={Gauge}>
          <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full" style={{background:`conic-gradient(rgb(var(--brand-600)) ${metrics.onboardingRate}%, rgb(var(--brand-100)) 0)`}}><div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-card"><strong className="text-3xl font-black">{metrics.onboardingRate}%</strong><span className="text-xs text-muted-foreground">{en?"onboarded":"مكتمل"}</span></div></div>
          <div className="mt-5 space-y-3 text-sm"><div><div className="mb-1 flex justify-between"><span>{en?"Business setup":"إعداد النشاط"}</span><strong>{overview.onboardedUsers}/{overview.users}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-600" style={{width:`${metrics.onboardingRate}%`}} /></div></div><div><div className="mb-1 flex justify-between"><span>{en?"Google sign-in":"الدخول عبر Google"}</span><strong>{metrics.googleRate}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{width:`${metrics.googleRate}%`}} /></div></div></div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel id="health" title={en?"Server errors (24 hours)":"أخطاء الخادم (24 ساعة)"} description={en?"Server-side failures recorded during the last 24 hours":"أعطال الخادم المسجلة خلال آخر 24 ساعة"} icon={Activity} action={<span className={`rounded-full px-3 py-1 text-xs font-bold ${overview.errors24h?"bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300":"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>{overview.errors24h?(en?"Needs attention":"يحتاج متابعة"):(en?"Healthy":"سليم")}</span>}>
          {overview.errorsByPath.length===0?<div className="flex min-h-40 flex-col items-center justify-center text-center"><CheckCircle2 className="h-10 w-10 text-emerald-500"/><p className="mt-3 font-bold">{en?"No server errors":"لا توجد أخطاء خادم"}</p><p className="mt-1 text-xs text-muted-foreground">{en?"Everything looks stable in the last 24 hours.":"النظام مستقر خلال آخر 24 ساعة."}</p></div>:<ul className="divide-y divide-border">{overview.errorsByPath.map(item=><li key={`${item.method}${item.path}${item.status}`} className="flex items-center gap-3 py-3"><span className="rounded-lg bg-red-50 px-2 py-1 font-mono text-xs font-bold text-red-700">{item.status}</span><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs" dir="ltr"><span className="text-muted-foreground">{item.method} </span><span>{item.path}</span></p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.lastAt)}</p></div><strong>× {item.count}</strong></li>)}</ul>}
        </Panel>
        <Panel title={en?"Attention center":"مركز التنبيهات"} description={en?"Items that may require an admin decision":"عناصر قد تحتاج قرارًا إداريًا"} icon={AlertTriangle}>
          {alerts.length===0?<div className="flex min-h-40 flex-col items-center justify-center text-center"><CheckCircle2 className="h-10 w-10 text-emerald-500"/><p className="mt-3 font-bold">{en?"Nothing needs attention":"لا توجد تنبيهات"}</p></div>:<ul className="space-y-2">{alerts.map(alert=><li key={alert.text} className={`rounded-xl border p-3 text-sm ${alert.tone==="red"?"border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300":"border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"}`}>{alert.text}</li>)}</ul>}
          <div className="mt-4 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-muted/60 p-3"><CalendarDays className="mx-auto h-4 w-4 text-muted-foreground"/><strong className="mt-1 block text-lg">{overview.newUsers30d}</strong><span className="text-xs text-muted-foreground">{en?"new / 30d":"جديد / 30 يوم"}</span></div><div className="rounded-xl bg-muted/60 p-3"><UserCheck className="mx-auto h-4 w-4 text-muted-foreground"/><strong className="mt-1 block text-lg">{overview.onboardedUsers}</strong><span className="text-xs text-muted-foreground">{en?"ready":"مكتمل"}</span></div></div>
        </Panel>
        <Panel title={en?"Platform snapshot":"ملخص المنصة"} description={en?"A concise operating view":"صورة تشغيلية مختصرة"} icon={BarChart3}><dl className="space-y-3 text-sm">{[[en?"Users without a business":"مستخدمون دون نشاط",overview.users-overview.onboardedUsers],[en?"Unverified email accounts":"بريد غير مؤكد",overview.unverifiedEmailUsers],[en?"Inactive businesses (7d)":"أنشطة غير نشطة (7 أيام)",Math.max(0,overview.businesses-overview.activeBusinesses7d)],[en?"Invoices per business":"فواتير لكل نشاط",metrics.avgInvoices]].map(([label,value])=><div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5"><dt className="text-muted-foreground">{label}</dt><dd className="font-black">{value}</dd></div>)}</dl></Panel>
      </div>

      <div id="behavior" className="scroll-mt-24"><BehaviorAnalytics en={en}/></div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3"><Panel id="support" title={en?"Customer support":"دعم العملاء"} description={en?"Find an account and send secure recovery links":"ابحث عن الحساب وأرسل روابط الاستعادة الآمنة"} icon={LifeBuoy}>
          <form onSubmit={search} className="flex gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input aria-label={en?"Search by email or shop name":"ابحث بالبريد أو اسم المحل"} placeholder={en?"Email, name or business":"البريد أو الاسم أو النشاط"} value={query} onChange={e=>setQuery(e.target.value)} className={`${fieldClass} ps-10`}/></div><button type="submit" disabled={searching||query.trim().length<2} className="min-h-11 shrink-0 rounded-xl bg-brand-700 px-5 text-sm font-bold text-white disabled:opacity-50">{searching?(en?"Searching…":"يبحث…"):(en?"Search":"بحث")}</button></form>
          {notice&&<p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${notice.ok?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-600"}`}>{notice.text}</p>}
          {results&&(results.length===0?<p className="mt-4 rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">{en?"No matching users":"لا يوجد مستخدم مطابق"}</p>:<ul className="mt-4 grid gap-3 md:grid-cols-2">{results.map(target=><li key={target.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-bold">{target.name||(en?"No name":"بدون اسم")}</p><p className="truncate text-xs text-muted-foreground" dir="ltr">{target.email}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${target.businessName?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{target.businessName?(en?"Ready":"مكتمل"):(en?"Not onboarded":"غير مكتمل")}</span></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{[target.businessName,target.google?"Google":(en?"Email & password":"بريد وكلمة مرور"),en?`${target.invoiceCount} invoices`:`${target.invoiceCount} فاتورة`,formatDate(target.createdAt)].filter(Boolean).join(" · ")}</p>{target.email&&target.hasPassword&&<div className="mt-3 flex flex-wrap gap-2">{!target.emailVerified&&linkButton(target,"verification-email",en?"Send verification link":"إرسال رابط تأكيد البريد")}{linkButton(target,"password-reset",en?"Send password reset link":"إرسال رابط تغيير كلمة المرور")}</div>}{!target.hasPassword&&<p className="mt-3 text-xs text-muted-foreground">{en?"Google account — no recovery link needed.":"حساب Google — لا يحتاج رابط استعادة."}</p>}</li>)}</ul>)}
        </Panel></div>
        <div className="lg:col-span-2"><Panel title={en?"Admin activity":"سجل إجراءات الإدارة"} description={en?"Latest support actions":"أحدث إجراءات الدعم"} icon={ShieldCheck}>{overview.recentAdminActions.length===0?<div className="flex min-h-40 flex-col items-center justify-center text-center"><ShieldCheck className="h-9 w-9 text-muted-foreground"/><p className="mt-3 text-sm font-bold">{en?"No admin actions yet":"لا توجد إجراءات إدارية بعد"}</p></div>:<ol className="relative space-y-4 before:absolute before:bottom-2 before:start-2 before:top-2 before:w-px before:bg-border">{overview.recentAdminActions.map((action,index)=><li key={`${action.createdAt}-${index}`} className="relative ps-7"><span className={`absolute start-0 top-1.5 h-4 w-4 rounded-full border-4 border-card ${action.result==="SENT"?"bg-emerald-500":"bg-red-500"}`}/><p className="text-sm font-bold">{ACTION_LABELS[action.action]?.[en?"en":"ar"]??action.action}</p><p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">{action.targetEmail??"—"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(action.createdAt)}</p></li>)}</ol>}</Panel></div>
      </div>
    </>}
  </div>;
}
