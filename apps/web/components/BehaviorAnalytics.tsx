"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
interface Measurement {
  days: number; startedAt: string | null; devices: number; sessions: number; activeDevices: number; repeatDevices: number;
  funnel: { visited: number; started: number; signedUp: number; onboarded: number; activated: number };
  events: { event: string; count: number; devices: number }[];
  pages: { path: string; views: number }[];
  sources: { source: string; devices: number }[];
  failures: { workflow: string; status: string; count: number }[];
}
const LABELS: Record<string, string> = { page_viewed: "مشاهدة صفحة", landing_viewed: "زيارة التعريف", cta_clicked: "طلب بدء التجربة", login_started: "بدء الدخول", login_failed: "تعثر الدخول", user_signed_up: "تسجيل حساب جديد", user_signed_in: "دخول ناجح", onboarding_started: "بدء إعداد النشاط", onboarding_completed: "إعداد النشاط", product_created: "إضافة منتج", invoice_created: "إنشاء فاتورة", expense_added: "إضافة مصروف", purchase_recorded: "تسجيل مشتريات", workflow_started: "محاولة حفظ", workflow_failed: "فشل الحفظ", session_started: "فتح جلسة عميل" };
const WORKFLOWS: Record<string,string> = { login: "الدخول", onboarding: "إعداد النشاط", product: "المنتج", invoice: "الفاتورة", expense: "المصروف", purchase: "المشتريات" };
export default function BehaviorAnalytics({ en }: { en: boolean }) {
  const [days, setDays] = useState(7); const [data, setData] = useState<Measurement | null>(null); const [error, setError] = useState(false); const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true; setData(null); setError(false);
    apiGet<Measurement>(`/admin/analytics?days=${days}`).then(value => { if (alive) { if (value?.funnel && Array.isArray(value.events)) setData(value); else setError(true); } }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [days, reload]);
  const stages = data ? [
    [en ? "Visited" : "زيارة التعريف أو الدخول", data.funnel.visited],
    [en ? "Started sign-in" : "بدأ التحقق من الدخول", data.funnel.started],
    [en ? "New account" : "سجّل حسابًا جديدًا", data.funnel.signedUp],
    [en ? "Business set up" : "أكمل إعداد النشاط", data.funnel.onboarded],
    [en ? "First saved action" : "حفظ أول منتج أو عملية", data.funnel.activated],
  ] as const : [];
  return <section aria-label={en ? "Customer behavior" : "سلوك العميل"} className="rounded-lg border border-border bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold">{en ? "Customer behavior" : "سلوك العميل"}</h2>
      <select aria-label={en ? "Measurement period" : "فترة القياس"} value={days} onChange={e => setDays(Number(e.target.value))} className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm">
        <option value={7}>{en ? "7 days" : "7 أيام"}</option><option value={30}>{en ? "30 days" : "30 يومًا"}</option>
      </select>
    </div>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">{en ? "Anonymous browser signals, not verified people. The funnel follows new-account steps in order on one device. Existing customers and other devices can fall outside it. No historical behavior is reconstructed." : "إشارات متصفح مجهولة، وليست أشخاصًا مؤكدين. المسار يتابع خطوات الحساب الجديد بالترتيب على الجهاز نفسه؛ العملاء السابقون والأجهزة الأخرى قد لا يدخلون فيه. لا تُسترجع الزيارات السابقة لتفعيل القياس."}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{en ? "Could not load behavior" : "تعذر تحميل سلوك العميل"} <button className="min-h-11 underline" onClick={() => setReload(v => v + 1)}>{en ? "Retry" : "إعادة المحاولة"}</button></p>}
    {!data && !error && <p className="mt-3 text-sm">{en ? "Loading…" : "جاري التحميل…"}</p>}
    {data && <>
      {!data.startedAt && <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">{en ? "No measurement events yet. Numbers start with new visits after activation." : "لا توجد أحداث قياس حتى الآن. تبدأ الأرقام مع الزيارات الجديدة بعد التفعيل."}</p>}
      <ol className="mt-4 space-y-2">{stages.map(([label, value], i) => <li key={label} className="rounded-lg bg-background p-3">
        <div className="flex justify-between gap-2 text-sm"><span>{label}</span><strong>{value}</strong></div>
        {i > 0 && Number(stages[i-1][1]) > 0 && <p className="mt-1 text-xs text-muted-foreground">{en ? "Did not reach this step yet: " : "لم يصلوا لهذه الخطوة حتى الآن: "}{Number(stages[i-1][1])-value}</p>}
      </li>)}</ol>
      <p className="mt-3 text-xs leading-6">{en ? `Devices: ${data.devices} · Sessions: ${data.sessions} · Saved actions: ${data.activeDevices} devices · Saved on 2+ days: ${data.repeatDevices}` : `الأجهزة: ${data.devices} · الجلسات: ${data.sessions} · أجهزة حفظت عمليات: ${data.activeDevices} · حفظت في يومين أو أكثر: ${data.repeatDevices}`}</p>
      <h3 className="mt-5 text-sm font-bold">{en ? "Actions" : "التفاعل والعمليات"}</h3>
      <ul className="mt-2 space-y-1 text-sm">{(data.events || []).map(row => <li key={row.event} className="flex justify-between gap-2"><span>{en ? row.event : LABELS[row.event] || row.event}</span><span>{row.count} / {row.devices} {en ? "devices" : "أجهزة"}</span></li>)}</ul>
      <h3 className="mt-5 text-sm font-bold">{en ? "Save and sign-in failures" : "تعثر الدخول والحفظ"}</h3>
      {!data.failures?.length && <p className="mt-2 text-xs text-muted-foreground">{en ? "No failures recorded in this period." : "لم تُسجّل أحداث فشل في هذه الفترة."}</p>}
      <ul className="mt-2 space-y-1 text-sm">{(data.failures || []).map(row => <li key={row.workflow+row.status}>{en ? row.workflow : WORKFLOWS[row.workflow] || row.workflow} · {row.status} · {row.count}</li>)}</ul>
      <h3 className="mt-5 text-sm font-bold">{en ? "Visit sources" : "مصادر الزيارات"}</h3>
      <ul className="mt-2 space-y-1 text-sm">{(data.sources || []).map(row => <li key={row.source} className="flex justify-between"><span>{row.source}</span><strong>{row.devices}</strong></li>)}</ul>
      <p className="mt-1 text-xs text-muted-foreground">{en ? "A device can appear under more than one source. Direct includes unknown sources." : "قد يظهر الجهاز في أكثر من مصدر. المصدر المباشر يشمل الزيارات مجهولة المصدر."}</p>
      <h3 className="mt-5 text-sm font-bold">{en ? "Pages viewed" : "الصفحات المشاهدة"}</h3>
      <ul className="mt-2 space-y-1 text-xs">{(data.pages || []).map(row => <li key={row.path} className="flex justify-between gap-2"><span dir="ltr">{row.path}</span><strong>{row.views}</strong></li>)}</ul>
    </>}
  </section>;
}
