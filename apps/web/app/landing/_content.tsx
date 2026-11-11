import Link from "next/link";
import SupportLink from "@/components/SupportLink";
import PricingSection from "@/components/pricing/PricingSection";
import SaleDemo from "./_sale-demo";
import CurrentMonth from "./_current-month";
import LandingTracker from "./_tracker";
import {
  FileText,
  Wallet,
  Package,
  BarChart3,
  ArrowLeft,
  Check,
  type LucideIcon,
} from "lucide-react";

/* ─── Data ──────────────────────────────────────────────────────────────────── */

const features: { icon: LucideIcon; title: string; benefit: string; body: string }[] = [
  {
    icon: FileText,
    title: "فواتير من الجوال",
    benefit: "لا تضيع وقتك في الورقة",
    body: "أصدر فاتورة باسم المحل والزبون، صدّرها PDF عربي، وأرسلها مباشرة.",
  },
  {
    icon: Wallet,
    title: "سجّل مصاريفك بوضوح",
    benefit: "اعرف أين يذهب كل ريال",
    body: "أدخل مصاريف التشغيل والمشتريات وصنّفها لتظهر في تقاريرك.",
  },
  {
    icon: Package,
    title: "مخزون ووصفات",
    benefit: "لا بضاعة تخلص بدون تحذير",
    body: "منتجات بوصفات دقيقة. الدفتر يحتسب تكلفة الإنتاج ويُنبّهك قبل نقص المخزون.",
  },
  {
    icon: BarChart3,
    title: "نتيجة مشروعك بوضوح",
    benefit: "قرّر بثقة في نهاية الشهر",
    body: "تقرير للمبيعات وتكلفة المخزون المباع والمصاريف التي سجلتها. اكتمال البيانات يحدد دقة النتيجة.",
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "ما هو تطبيق دفتر؟",
    a: "دفتر تطبيق محاسبة عربي مبسّط للمشاريع الصغيرة والأسر المنتجة في السعودية. يتيح تتبع المبيعات والمصاريف والفواتير والمخزون من مكان واحد — بلا مصطلحات محاسبية.",
  },
  {
    q: "هل دفتر مجاني؟",
    a: "الوظائف الحالية متاحة مجانًا، ولا تحتاج بطاقة ائتمانية. أي باقات مدفوعة مستقبلية ستُعلن مع حدودها وسياسة انتقال واضحة قبل تطبيقها.",
  },
  {
    q: "هل يحتاج استخدامه تدريبًا أو خبرة محاسبية؟",
    a: "لا. دفتر مصمّم لأصحاب المشاريع الصغيرة بلا خلفية محاسبية. الواجهة بلغة السوق اليومية — إذا عرفت تبيع، تقدر تستخدمه.",
  },
  {
    q: "هل يعمل على الجوال؟",
    a: "نعم. دفتر تطبيق ويب تقدر تضيفه لشاشتك الرئيسية مثل أي تطبيق، ويعمل بسلاسة على iOS وAndroid.",
  },
  {
    q: "كيف يختلف دفتر عن QuickBooks أو برامج المحاسبة الأخرى؟",
    a: "برامج المحاسبة الكبيرة مصمّمة لمحاسبين في شركات كبيرة. دفتر مصمّم لصاحب محل أو أسرة منتجة — واجهة بسيطة، عربي كامل، يشتغل من الجوال مباشرة.",
  },
  {
    q: "هل بياناتي آمنة؟",
    a: "يستخدم دفتر ضوابط لفصل حسابات المنشآت. تعالج خدمات الاستضافة وتسجيل الدخول البيانات اللازمة لتشغيله؛ راجع إشعار الخصوصية لتفاصيل البيانات ومزودي الخدمة.",
  },
  {
    q: "هل يدعم دفتر اللغة الإنجليزية؟",
    a: "يمكن التبديل بين العربية والإنجليزية من داخل التطبيق في أي وقت.",
  },
];

/* ─── Atoms ─────────────────────────────────────────────────────────────────── */

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

function DirectionalNumber({ children }: { children: React.ReactNode }) {
  return (
    <bdi dir="ltr" className="inline-block tabular-nums">
      {children}
    </bdi>
  );
}

function LedgerPreview() {
  const rows = [
    { name: "طلب معمول — أم فيصل",  amount: "480", paid: true },
    { name: "كيك عيد ميلاد — نورة", amount: "220", paid: true },
    { name: "علبة ضيافة — مكتب",    amount: "650", paid: false },
  ];
  return (
    <div className="mx-auto w-full max-w-[22rem] rounded-[2rem] border border-gray-200 bg-[#101914] p-2 shadow-2xl shadow-brand-900/10">
      <div className="overflow-hidden rounded-[1.55rem] bg-[#f7f8f7]">
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-700 text-sm font-extrabold text-white">د</span>
          <span className="text-xs font-bold text-gray-600">لوحة اليوم</span>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="motion-surface rounded-lg border border-brand-100 bg-brand-50 p-3">
              <p className="text-xs font-bold text-gray-600">صافي ربح الشهر</p>
              <p className="mt-1 text-xl font-extrabold text-brand-700">
                <DirectionalNumber>2,340</DirectionalNumber> ريال
              </p>
            </div>
            <div className="motion-surface rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-bold text-gray-600">مصاريف التشغيل</p>
              <p className="mt-1 text-xl font-extrabold text-amber-700">
                <DirectionalNumber>680</DirectionalNumber> ريال
              </p>
            </div>
          </div>

          <div className="motion-surface rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-[#101914]">فواتير اليوم</span>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <CurrentMonth />
              </span>
            </div>
            <ul className="mt-3">
              {rows.map((r, idx) => (
                <li
                  key={r.name}
                  className={`flex items-center justify-between gap-3 py-2.5 ${
                    idx !== rows.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#101914]">{r.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-extrabold text-[#101914]">
                      <DirectionalNumber>{r.amount}</DirectionalNumber> ريال
                    </span>
                    {r.paid ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">مدفوعة</span>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">آجل</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="motion-surface rounded-lg bg-white p-2 shadow-sm">
              <p className="text-base font-extrabold text-brand-700"><DirectionalNumber>12</DirectionalNumber></p>
              <p className="text-xs font-bold text-gray-600">فاتورة</p>
            </div>
            <div className="motion-surface rounded-lg bg-white p-2 shadow-sm">
              <p className="text-base font-extrabold text-amber-700"><DirectionalNumber>4</DirectionalNumber></p>
              <p className="text-xs font-bold text-gray-600">مصاريف</p>
            </div>
            <div className="motion-surface rounded-lg bg-white p-2 shadow-sm">
              <p className="text-base font-extrabold text-rose-700"><DirectionalNumber>2</DirectionalNumber></p>
              <p className="text-xs font-bold text-gray-600">آجل</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main content component ────────────────────────────────────────────────── */

export default function LandingContent() {
  return (
    <main className="landing-page min-h-screen bg-[#f7f8f7] text-[#101914]" dir="rtl" lang="ar">
      <LandingTracker />

      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-1 sm:gap-3">
            <a href="#pricing" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-gray-600 hover:text-brand-700">المتاح مجانًا</a>
            <a href="#faq" className="hidden rounded-2xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:text-brand-700 sm:inline-block">
              الأسئلة الشائعة
            </a>
            <a href="#features" className="hidden rounded-2xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:text-brand-700 sm:inline-block">
              المزايا
            </a>
            <Link
              href="/login"
              className="motion-press rounded-2xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800"
            >
              ابدأ مجانًا
            </Link>
          </div>
        </nav>
      </header>

      {/* ── 1. Hero ── */}
      <section className="mx-auto grid w-full max-w-5xl items-center gap-8 px-5 pb-10 pt-6 sm:gap-12 sm:pb-20 sm:pt-20 lg:grid-cols-[1fr_0.9fr]">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700">
            للأسر المنتجة والبيع من المنزل في السعودية
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">
            اعرف ربحك
            <br />
            <span className="text-brand-700">من جوالك.</span>
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-700 sm:text-lg">
            سجّل مبيعاتك ومصاريفك وتكلفة منتجاتك، واعرف ربح مشروعك من مكان واحد — بدون خبرة محاسبية.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="motion-press inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-800"
            >
              جرّب مجانًا
              <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
            </Link>
            <a
              href="#how"
              className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
            >
              كيف يشتغل؟
            </a>
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {["متاح مجانًا حاليًا", "مصمم بالعربي", "من جوالك"].map((t) => (
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

      <SaleDemo />

      {/* ── 3. Features as Benefits ── */}
      <section id="features" className="border-t border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            كل حساباتك في دفتر واحد
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
            أربع أدوات تكفي لتدير مشروعك — بلا تعقيد ولا مصطلحات.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, benefit, body }) => (
            <article key={title} className="motion-surface rounded-lg border border-gray-100 bg-[#f7f8f7] p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <h3 className="mt-4 text-base font-bold">{title}</h3>
              <p className="mt-1 text-xs font-semibold text-brand-700">{benefit}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
            </article>
          ))}
        </div>
        </div>
      </section>

      <section aria-labelledby="use-cases-title" className="mx-auto max-w-5xl px-5 py-12">
        <h2 id="use-cases-title" className="text-2xl font-extrabold">كيف تستفيد منه في مشروعك؟</h2>
        <p className="mt-2 text-sm text-gray-700">أمثلة توضيحية للاستخدام، وليست شهادات عملاء.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { title: "مشروع معمول", body: "سجّل طلباتك وحدد المدفوع والآجل، ثم تابع المبالغ المتبقية." },
            { title: "مشروع كيك منزلي", body: "أضف مقادير الوصفة وتكلفتها، ثم أصدر فاتورة جاهزة للإرسال." },
            { title: "تموينات صغيرة", body: "سجّل المشتريات والمصاريف، وراجع المنتجات التي أوشكت على النفاد." },
          ].map(({ title, body }) => <article key={title} className="rounded-xl border border-gray-200 bg-white p-5"><h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-7 text-gray-700">{body}</p></article>)}
        </div>
      </section>

      <PricingSection />

      {/* ── 7. FAQ ── */}
      <section id="faq" className="border-t border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-20">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            الأسئلة الشائعة
          </h2>
          <dl className="mt-10 space-y-6">
            {faqs.map(({ q, a }) => (
              <div key={q} className="motion-surface rounded-lg border border-gray-100 bg-[#f7f8f7] p-5">
                <dt className="text-base font-bold text-[#101914]">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-gray-600">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 9. Final CTA ── */}
      <section className="border-t border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-24 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            ابدأ تتابع حساباتك اليوم — مجانًا
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
            سجّل مبيعات مشروعك المنزلي وتكاليفه، وراجع نتيجته الشهرية بناءً على بياناتك.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="motion-press inline-flex items-center gap-2 rounded-2xl bg-brand-700 px-7 py-4 text-base font-bold text-white transition-colors hover:bg-brand-800"
            >
              سجّل مشروعك الآن — مجاني
              <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
            </Link>
            <a
              href="#how"
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-gray-600 underline-offset-2 hover:text-brand-700 hover:underline"
            >
              كيف يشتغل؟
            </a>
          </div>
          <p className="mt-5 text-xs text-gray-600">
            دفتر مجاني للبدء، ومصمم عربيًا للمشاريع الصغيرة في السعودية.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Logo />
          <p className="text-xs text-gray-600">
            دفتر — تطبيق محاسبة للمشاريع الصغيرة · صنع في السعودية، للسعودية.
          </p>
          <nav aria-label="روابط الموقع" className="flex items-center gap-1 text-xs font-semibold text-gray-600">
            <Link href="/privacy" className="inline-flex min-h-11 items-center px-3 hover:text-brand-700">
              إشعار الخصوصية
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center px-3 hover:text-brand-700">
              تسجيل الدخول
            </Link>
          </nav>
        </div>
      </footer>
      <div className="flex justify-center px-5 pb-6"><SupportLink /></div>

    </main>
  );
}
