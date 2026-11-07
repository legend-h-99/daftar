import Link from "next/link";
import SupportLink from "@/components/SupportLink";
import PricingSection from "@/components/pricing/PricingSection";
import CurrentMonth from "./_current-month";
import LandingTracker from "./_tracker";
import MobileMenu from "./_mobile-menu";
import { PRICING_PLANS } from "@/lib/pricing";
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
  Smartphone,
  ShieldCheck,
  MapPin,
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

const steps: { icon: LucideIcon; num: number; title: string; body: string }[] = [
  { icon: PenLine, num: 1, title: "سجّل محلك", body: "أدخل اسم محلك ومدينتك — يأخذ أقل من دقيقة." },
  { icon: Eye,     num: 2, title: "ابدأ التسجيل", body: "بعد كل بيعة أو مصروف، دوّنه فورًا من الجوال." },
  { icon: TrendingUp, num: 3, title: "شوف ربحك", body: "راجع المبيعات والتكاليف المسجلة بنقرة واحدة؛ لا تشمل النتيجة بيانات لم تدخلها." },
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
    a: "نعم. دفتر تطبيق ويب تقدر تضيفه لشاشتك الرئيسية مثل أي تطبيق، ويعمل من متصفح الآيفون والأندرويد.",
  },
  {
    q: "هل فواتير دفتر متوافقة مع هيئة الزكاة والضريبة والجمارك؟",
    a: "إذا كنت مسجلًا في ضريبة القيمة المضافة، يُصدر دفتر فاتورة ضريبية مبسطة برقمك الضريبي ورمز QR الخاص بالمرحلة الأولى. الربط مع منصة «فاتورة» للمرحلة الثانية غير متاح حاليًا، فإذا شملتك المرحلة الثانية استخدم حلًا مربوطًا بالمنصة لفواتيرك الضريبية.",
  },
  {
    q: "كيف يختلف دفتر عن QuickBooks أو برامج المحاسبة الأخرى؟",
    a: "برامج المحاسبة الكبيرة مصمّمة لمحاسبين في شركات كبيرة. دفتر مصمّم لصاحب محل أو أسرة منتجة — واجهة بسيطة، عربي كامل، يشتغل من الجوال مباشرة.",
  },
  {
    q: "هل بياناتي آمنة؟",
    a: "يستخدم دفتر مصادقة وضوابط لعزل حسابات المنشآت. لا توجد حماية مطلقة؛ راجع إشعار الخصوصية لمعرفة البيانات المستخدمة والخدمات التي تعالجها.",
  },
  {
    q: "هل يدعم دفتر اللغة الإنجليزية؟",
    a: "يمكن التبديل بين العربية والإنجليزية من داخل التطبيق في أي وقت.",
  },
];

const comparisons: { feature: string; daftar: boolean | string; paper: boolean | string; quickbooks: boolean | string }[] = [
  { feature: "عربي بالكامل (RTL)", daftar: true, paper: "—", quickbooks: false },
  { feature: "يعمل على الجوال فورًا", daftar: true, paper: true, quickbooks: false },
  { feature: "تقرير الربح الشهري", daftar: true, paper: false, quickbooks: true },
  { feature: "متابعة المخزون والوصفات", daftar: true, paper: false, quickbooks: true },
  { feature: "بدون مصطلحات محاسبية", daftar: true, paper: true, quickbooks: false },
  { feature: "متاح مجانًا حاليًا", daftar: true, paper: true, quickbooks: false },
  { feature: "محاسبة متقدمة للشركات الكبيرة", daftar: false, paper: false, quickbooks: true },
];

const testimonials = [
  {
    name: "محل معمول ومقبلات",
    role: "مثال توضيحي",
    body: "سيناريو محل معمول: فواتير يومية، طلبات آجلة، وصافي ربح واضح آخر الشهر.",
  },
  {
    name: "كيك منزلي",
    role: "مثال توضيحي",
    body: "سيناريو كيك منزلي: وصفات بمقادير دقيقة، تكلفة إنتاج، وفاتورة جاهزة للإرسال.",
  },
  {
    name: "تموينات صغيرة",
    role: "مثال توضيحي",
    body: "سيناريو تموينات: مشتريات ومصاريف ومخزون منخفض تظهر في نفس الدفتر.",
  },
];

const SITE_URL = "https://daftar1.com";

/** Digits only, e.g. 9665XXXXXXXX. The WhatsApp link renders only when this is set at build time. */
const SUPPORT_WHATSAPP = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "دفتر",
      alternateName: "Daftar",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon`,
      email: "info@daftar1.com",
      areaServed: "SA",
    },
    {
      "@type": "SoftwareApplication",
      name: "دفتر",
      alternateName: "Daftar",
      url: `${SITE_URL}/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      inLanguage: ["ar", "en"],
      publisher: { "@id": `${SITE_URL}/#organization` },
      // Only the plan that is live today; paid plans are announced but not yet billable.
      offers: PRICING_PLANS.filter((plan) => plan.monthly === 0).map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: "0",
        priceCurrency: "SAR",
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

const trustSignals: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: MapPin, title: "صنع في السعودية، للسعودية", body: "لغة السوق السعودي اليومية، من أسماء العملاء إلى الريال والفواتير." },
  { icon: Smartphone, title: "جوال أولًا بلا تنازل", body: "مصمّم للإبهام، للجلسات القصيرة، وللتسجيل بعد البيعة مباشرة." },
  { icon: ShieldCheck, title: "بياناتك لك وحدك", body: "كل حساب معزول عن غيره، وإشعار الخصوصية يوضح البيانات المستخدمة والجهات التي تعالجها." },
];

/* ─── Atoms ─────────────────────────────────────────────────────────────────── */

function Logo() {
  return (
    <Link href="/" aria-label="دفتر — الصفحة الرئيسية" className="flex min-h-11 items-center gap-2 rounded-xl">
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-700 text-lg font-extrabold text-white">
        د
      </span>
      <span className="text-lg font-extrabold text-[#101914]">دفتر</span>
    </Link>
  );
}

function CellIcon({ val }: { val: boolean | string }) {
  if (val === true) {
    return (
      <span className="text-lg font-bold text-brand-700">
        <span aria-hidden="true">✓</span>
        <span className="sr-only">نعم</span>
      </span>
    );
  }
  if (val === false) {
    return (
      <span className="text-lg font-bold text-red-600">
        <span aria-hidden="true">✗</span>
        <span className="sr-only">لا</span>
      </span>
    );
  }
  return <span className="text-sm text-gray-600">{val}</span>;
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
          <span className="text-xs font-bold text-gray-500">لوحة اليوم</span>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="motion-surface rounded-lg border border-brand-100 bg-brand-50 p-3">
              <p className="text-[11px] font-bold text-gray-500">صافي ربح الشهر</p>
              <p className="mt-1 text-xl font-extrabold text-brand-700">
                <DirectionalNumber>2,340</DirectionalNumber> ريال
              </p>
            </div>
            <div className="motion-surface rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-[11px] font-bold text-gray-500">مصاريف التشغيل</p>
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
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">مدفوعة</span>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">آجل</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="motion-surface rounded-lg bg-white p-2 shadow-sm">
              <p className="text-base font-extrabold text-brand-700"><DirectionalNumber>12</DirectionalNumber></p>
              <p className="text-[10px] font-bold text-gray-500">فاتورة</p>
            </div>
            <div className="motion-surface rounded-lg bg-white p-2 shadow-sm">
              <p className="text-base font-extrabold text-amber-700"><DirectionalNumber>4</DirectionalNumber></p>
              <p className="text-[10px] font-bold text-gray-500">مصاريف</p>
            </div>
            <div className="motion-surface rounded-lg bg-white p-2 shadow-sm">
              <p className="text-base font-extrabold text-rose-700"><DirectionalNumber>2</DirectionalNumber></p>
              <p className="text-[10px] font-bold text-gray-500">آجل</p>
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
    <main className="min-h-screen bg-[#f7f8f7] text-[#101914]" dir="rtl" lang="ar">
      <LandingTracker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      <a
        href="#content"
        className="sr-only z-30 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:right-4 focus:top-3"
      >
        تخطَّ إلى المحتوى
      </a>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-1 sm:gap-3">
            <nav aria-label="أقسام الصفحة" className="hidden items-center gap-1 sm:flex">
              <a href="#features" className="inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-semibold text-gray-600 transition-colors hover:text-brand-700">
                المزايا
              </a>
              <a href="#pricing" className="inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-semibold text-gray-600 transition-colors hover:text-brand-700">
                الباقات
              </a>
              <a href="#faq" className="inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-semibold text-gray-600 transition-colors hover:text-brand-700">
                الأسئلة الشائعة
              </a>
            </nav>
            <Link
              href="/login"
              className="motion-press inline-flex min-h-11 items-center rounded-2xl bg-brand-700 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-800"
            >
              ابدأ مجانًا
            </Link>
            <MobileMenu />
          </div>
        </div>
      </header>

      {/* ── 1. Hero ── */}
      <section id="content" tabIndex={-1} className="scroll-mt-16 mx-auto grid w-full max-w-5xl items-center gap-8 px-5 pb-12 pt-10 outline-none sm:gap-12 sm:pb-20 sm:pt-20 lg:grid-cols-[1fr_0.9fr]">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700">
            للأسر المنتجة والبيع من المنزل في السعودية
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">
            اعرف ربحك
            <br />
            <span className="text-brand-700">من جوالك.</span>
          </h1>

          <blockquote className="mt-5 max-w-xl border-r-4 border-brand-700 pr-4 text-base leading-relaxed text-gray-600 sm:text-lg">
            دفتر تطبيق محاسبة عربي مبسّط للأسر المنتجة والبيع من المنزل في السعودية. سجّل مبيعاتك ومصاريفك ومكوّنات منتجاتك، وشاهد كم ربحت فعلاً بدون خبرة محاسبية.
          </blockquote>

          <div className="mt-8 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-5">
            <Link
              href="/login"
              className="motion-press inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-800"
            >
              جرّب مجانًا
              <ArrowLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            </Link>
            <a
              href="#how"
              className="inline-flex min-h-11 items-center justify-center px-2 text-base font-semibold text-gray-700 underline-offset-4 hover:text-brand-700 hover:underline"
            >
              كيف يشتغل؟
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {["متاح مجانًا حاليًا", "عربي RTL أصيل", "مصمم للاستخدام من الجوال"].map((t) => (
              <li key={t} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600">
                <Check className="h-4 w-4 text-brand-700" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <figure className="animate-fade-up [animation-delay:120ms]">
          <div aria-hidden="true">
            <LedgerPreview />
          </div>
          <figcaption className="mt-3 text-center text-xs font-semibold text-gray-600">
            مثال توضيحي لشاشة دفتر — الأسماء والأرقام ليست بيانات حقيقية.
          </figcaption>
        </figure>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-3 gap-4 px-5 py-10 text-center">
          {[
            { num: "0", label: "ريال رسوم اشتراك" },
            { num: "بخطوات بسيطة", label: "لتسجيل البيع والمصروف" },
            { num: "بوضوح", label: "لمراجعة نتيجتك الشهرية" },
          ].map(({ num, label }) => (
            <div key={label}>
              <p className="text-2xl font-extrabold text-brand-700 sm:text-3xl">
                <DirectionalNumber>{num}</DirectionalNumber>
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-500 sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. Problem + Solution ── */}
      <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1 text-xs font-semibold text-brand-700">المشكلة والحل</span>
            <h2 className="mt-4 text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
              الأدوات الموجودة صُمِّمت لمحاسبين في شركات، <span className="text-brand-700">ودفتر صُمّم لصاحب المشروع.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-gray-700">
              برامج المحاسبة الغربية مليئة بمصطلحات وقوائم طويلة، والورقة والقلم تضيع ولا تحسب التكلفة الحقيقية. دفتر يأخذ شعور الدفتر الورقي ويضيف له فواتير، مصاريف، مخزون، وربح شهري بلغة السوق اليومية.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: "قبل دفتر", body: "طلبات موزعة بين واتساب، ورقة، وذاكرة صاحب المشروع.", tone: "border-rose-100 bg-rose-50 text-rose-700" },
              { title: "بعد دفتر", body: "كل بيعة ومصروف يظهران في تقرير ربح واضح آخر الشهر.", tone: "border-brand-100 bg-brand-50 text-brand-700" },
            ].map(({ title, body, tone }) => (
              <article key={title} className={`motion-surface rounded-lg border p-5 ${tone}`}>
                <h3 className="text-base font-extrabold">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Features as Benefits ── */}
      <section id="features" className="scroll-mt-16 border-t border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            كل حساباتك في دفتر واحد
          </h2>
          <p className="mt-3 text-base leading-relaxed text-gray-700">
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
              <p className="mt-2 text-[15px] leading-relaxed text-gray-700">{body}</p>
            </article>
          ))}
        </div>
        </div>
      </section>

      {/* ── 4. Product Proof ── */}
      <section>
        <div className="mx-auto w-full max-w-5xl px-5 py-20">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            سيناريوهات توضيحية للاستخدام
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {testimonials.map(({ name, role, body }) => (
              <figure key={name} className="motion-surface rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <blockquote className="text-sm font-semibold leading-relaxed text-gray-700">{body}</blockquote>
                <figcaption className="mt-4">
                  <p className="text-sm font-bold text-[#101914]">{name}</p>
                  <p className="text-xs text-gray-500">{role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. How It Works ── */}
      <section id="how" className="scroll-mt-16 border-t border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-5xl px-5 py-20">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">ثلاث خطوات، وخلاص</h2>
            <p className="mt-3 text-base leading-relaxed text-gray-700">
              من التسجيل إلى معرفة ربحك الشهري — في أقل من دقيقة للبدء.
            </p>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map(({ icon: Icon, num, title, body }) => (
              <li key={title} className="text-center">
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="h-6 w-6" strokeWidth={2.5} />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-xs font-extrabold text-white">
                    {num}
                  </span>
                </span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 6. Comparison ── */}
      <section className="mx-auto w-full max-w-5xl px-5 py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            دفتر مقارنةً بالبدائل
          </h2>
          <p className="mt-3 text-base leading-relaxed text-gray-700">
            مقارنة صادقة — بما فيها نقطة واحدة تفوز فيها البدائل.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
          <table className="w-full table-fixed text-center text-sm">
            <colgroup>
              <col className="w-[34%]" />
              <col />
              <col />
              <col />
            </colgroup>
            <thead className="bg-white text-xs text-gray-600 sm:text-sm">
              <tr>
                <th scope="col" className="px-1.5 py-3 text-right font-semibold sm:px-3">الميزة</th>
                <th scope="col" className="bg-brand-50 px-1 py-3 font-extrabold text-brand-700 sm:px-3">دفتر</th>
                <th scope="col" className="px-1 py-3 font-semibold sm:px-3">ورقة وقلم</th>
                <th scope="col" className="px-1 py-3 font-semibold sm:px-3">QuickBooks</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map(({ feature, daftar, paper, quickbooks }, i) => (
                <tr key={feature} className={`${i !== comparisons.length - 1 ? "border-t border-gray-100" : ""} ${i % 2 !== 0 ? "bg-gray-50/50" : ""}`}>
                  <th scope="row" className="px-1.5 py-3 text-right text-[13px] font-medium leading-snug text-[#101914] sm:px-3 sm:text-sm">{feature}</th>
                  <td className="bg-brand-50/70 px-2 py-3 sm:px-3"><CellIcon val={daftar} /></td>
                  <td className="px-2 py-3 sm:px-3"><CellIcon val={paper} /></td>
                  <td className="px-2 py-3 sm:px-3"><CellIcon val={quickbooks} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-center text-xs text-gray-500">
          * QuickBooks يتفوق في المحاسبة المتقدمة للشركات الكبيرة — وهذا ليس جمهورنا.
        </p>
      </section>

      <PricingSection />

      {/* ── 7. FAQ ── */}
      <section id="faq" className="scroll-mt-16 border-t border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-20">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            الأسئلة الشائعة
          </h2>
          <ul className="mt-10 space-y-6">
            {faqs.map(({ q, a }) => (
              <li key={q} className="motion-surface rounded-lg border border-gray-100 bg-[#f7f8f7] p-5">
                <h3 className="text-base font-bold text-[#101914]">{q}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-700">{a}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 8. Trust Signals ── */}
      <section className="mx-auto w-full max-w-5xl px-5 py-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {trustSignals.map(({ icon: Icon, title, body }) => (
            <div key={title} className="motion-surface rounded-lg border border-gray-100 bg-white p-6 text-center shadow-sm">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <h3 className="mt-3 text-base font-bold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-700">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 9. Final CTA ── */}
      <section className="border-t border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-24 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            ابدأ تتابع حساباتك اليوم — مجانًا
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-gray-700">
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
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-gray-500 underline-offset-2 hover:text-brand-700 hover:underline"
            >
              كيف يشتغل؟
            </a>
          </div>
          <p className="mt-5 text-xs text-gray-500">
            دفتر مجاني للبدء، ومصمم عربيًا للمشاريع الصغيرة في السعودية.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Logo />
          <p className="text-xs text-gray-500">
            دفتر — تطبيق محاسبة للمشاريع الصغيرة · صنع في السعودية، للسعودية.
          </p>
          <nav aria-label="روابط الموقع" className="flex flex-wrap items-center justify-center gap-1 text-xs font-semibold text-gray-600">
            {SUPPORT_WHATSAPP && (
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center px-3 hover:text-brand-700"
              >
                واتساب الدعم
              </a>
            )}
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
