import Link from "next/link";
import type { Metadata } from "next";
import {
  FileText,
  Wallet,
  Package,
  BarChart3,
  ArrowLeft,
  Check,
  PenLine,
  Eye,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "دفتر — حساباتك، بلغتك",
  description:
    "تطبيق محاسبة عربي مبسّط للأسر المنتجة والمشاريع الصغيرة. تابع مبيعاتك ومصاريفك وأرباحك من مكان واحد — بلغة تفهمها لا بمصطلحات محاسبية.",
};

/* ─────────────────────────── data ─────────────────────────── */

const features: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FileText, title: "الفواتير", body: "أصدر فاتورة باسمك، صدّرها PDF عربي، وأرسلها للعميل فورًا." },
  { icon: Wallet, title: "المصاريف", body: "سجّل مصروف المشتريات والتشغيل في ثوانٍ وصنّفه." },
  { icon: Package, title: "المخزون والمنتجات", body: "منتجات بوصفات دقيقة، والدفتر يحتسب تكلفة الإنتاج تلقائيًا." },
  { icon: BarChart3, title: "التقارير", body: "تقرير شهري واضح: دخل، مصاريف، وصافي ربح." },
];

const steps: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: PenLine, title: "سجّل", body: "بعد كل بيعة، أضف الفاتورة في أقل من 30 ثانية." },
  { icon: Eye, title: "تابع", body: "شوف مبيعاتك ومصاريفك ومن لك عنده أول بأول." },
  { icon: TrendingUp, title: "اعرف ربحك", body: "آخر الشهر يطلع لك صافي ربحك بدون ما تسأل أحد." },
];

const trust = ["عربي كامل RTL", "بلا مصطلحات محاسبية", "يعمل على الجوال بدون تدريب"];

/* ─────────────────────────── atoms ─────────────────────────── */

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-700 text-lg font-extrabold text-white">
        د
      </span>
      <span className="text-lg font-extrabold text-[#101914]">دفتر</span>
    </span>
  );
}

/* A real "دفتر" ledger preview — the paper motif, built from rows (no gradients). */
function LedgerPreview() {
  const rows = [
    { name: "طلب معمول — أم فيصل", amount: "٤٨٠", paid: true },
    { name: "كيك عيد ميلاد — نورة", amount: "٢٢٠", paid: true },
    { name: "علبة ضيافة — مكتب", amount: "٦٥٠", paid: false },
  ];
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[#101914]">فواتير اليوم</span>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          الأحد ١٨ يوليو
        </span>
      </div>
      <ul className="mt-4">
        {rows.map((r, idx) => (
          <li
            key={r.name}
            className={`flex items-center justify-between py-3 ${
              idx !== rows.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span className="text-sm font-medium text-[#101914]">{r.name}</span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#101914]">{r.amount} ﷼</span>
              {r.paid ? (
                <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803d]">
                  مدفوعة
                </span>
              ) : (
                <span className="rounded-full bg-[#fef2f2] px-2.5 py-0.5 text-[11px] font-semibold text-[#dc2626]">
                  آجل
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
        <span className="text-sm font-semibold text-gray-600">ربح اليوم</span>
        <span className="text-lg font-extrabold text-brand-700">٧٤٠ ﷼</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f7] text-[#101914]">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden rounded-2xl px-4 py-2 text-sm font-bold text-gray-600 transition-colors hover:text-brand-700 sm:inline-block">
              المزايا
            </a>
            <Link
              href="/login"
              className="rounded-2xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 active:bg-brand-800"
            >
              ابدأ الآن
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-5 pb-20 pt-16 sm:pt-24 lg:grid-cols-2">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700">
            للأسر المنتجة والمشاريع الصغيرة
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">
            حساباتك،
            <br />
            <span className="text-brand-700">بلغتك.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-gray-600 sm:text-lg">
            دفتر يحلّ محل الورقة والقلم والجداول اليدوية. تابع مبيعاتك ومصاريفك
            وفواتيرك وأرباحك من مكان واحد — بلغة تفهمها، لا بمصطلحات محاسبية.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-800 active:bg-brand-800"
            >
              جرّب مجانًا
              <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-3.5 text-base font-bold text-[#101914] transition-colors hover:border-brand-200 hover:bg-brand-50"
            >
              كيف يشتغل؟
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {trust.map((t) => (
              <li key={t} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600">
                <Check className="h-4 w-4 text-brand-700" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="animate-fade-up [animation-delay:120ms]">
          <LedgerPreview />
        </div>
      </section>

      {/* Problem strip */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-14 text-center">
          <p className="text-xl font-extrabold leading-relaxed sm:text-2xl">
            الأدوات المتاحة صُمِّمت لمحاسبين،
            <span className="text-brand-700"> لا لأمٍّ تبيع المعمول من المنزل.</span>
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">
            دفتر ورقي ذكي — مألوف ومريح كالورقة والقلم، لكنه أسرع وأدق. الوضوح قبل كل
            شيء، ولغة السوق لا لغة الأكاديمية.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-5xl px-5 py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            كل حساباتك في دفتر واحد
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
            أربع أدوات تكفي لتدير مشروعك — بلا تعقيد ولا مصطلحات.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <h3 className="mt-4 text-base font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-5xl px-5 py-20">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">ثلاث خطوات، وخلاص</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
              من أول بيعة إلى معرفة ربحك الشهري.
            </p>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="text-center">
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon className="h-6 w-6" strokeWidth={2.5} />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-xs font-extrabold text-white">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA footer */}
      <section className="mx-auto w-full max-w-5xl px-5 py-24">
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm sm:p-14">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            حساباتك، بلغتك — ابدأ اليوم
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
            بضع نقرات تكفي لتشوف ربحك الحقيقي آخر الشهر. مجانًا، وعربي بالكامل.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-7 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-800 active:bg-brand-800"
          >
            ابدأ الآن
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Logo />
          <p className="text-xs text-gray-500">دفتر — صنع في السعودية، للسعودية.</p>
        </div>
      </footer>
    </main>
  );
}
