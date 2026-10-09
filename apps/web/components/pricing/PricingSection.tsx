import Link from "next/link";
import { PRICING_PLANS, OCR_TOP_UP } from "@/lib/pricing";

export default function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" dir="rtl" className="border-t border-gray-100 bg-white text-gray-900">
      <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <h2 id="pricing-title" className="text-center text-2xl font-extrabold sm:text-3xl">باقات تناسب حجم مشروعك</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-7 text-gray-600">ابدأ مجانًا، واختر السعة المناسبة عندما يكبر استخدامك.</p>
        <p role="note" className="mx-auto mt-5 max-w-2xl rounded-xl bg-amber-50 p-4 text-center text-sm leading-7 text-amber-900">الباقات المدفوعة وقراءة الفواتير الآلية قريبًا. الوظائف الحالية متاحة مجانًا، وحدود الباقات المعروضة لم تُطبّق بعد. لا يتم تحصيل أي مبلغ الآن.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PRICING_PLANS.map(plan => (
            <article key={plan.id} aria-label={`باقة ${plan.name}`} className={`flex flex-col rounded-2xl border p-6 ${plan.id === "basic" ? "border-brand-600 bg-brand-50/40" : "border-gray-200"}`}>
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-4"><span className="text-4xl font-extrabold">{plan.monthly}</span><span className="mr-2 text-sm text-gray-600">ريال / شهر</span></p>
              <p className="mt-2 min-h-7 text-sm text-gray-600">{plan.annual ? `${plan.annual} ريال سنويًا، تُدفع مقدمًا عند تفعيل الاشتراكات` : "بدون بطاقة ائتمانية"}</p>
              <ul className="mt-6 space-y-3 text-sm leading-6">
                <li>{plan.invoices} فواتير شهريًا</li>
                <li>{plan.products} منتجات ووصفات نشطة</li>
                <li>{plan.ocrPages} صفحات قراءة آلية {plan.id === "free" ? "للتجربة مرة واحدة" : "شهريًا"} — قريبًا</li>
                <li>حساب تكلفة الوصفات وتسجيل المصاريف والمشتريات</li>
                <li>متابعة المخزون والمبالغ غير المدفوعة</li>
                <li>ملخص المبيعات والتكاليف وفواتير PDF</li>
                <li>نشاط واحد ومستخدم واحد</li>
              </ul>
              <div className="mt-auto pt-6">
                {plan.id === "free" ? <Link href="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-700 px-4 py-3 font-bold text-white">ابدأ بالبداية مجانًا</Link> : <button type="button" disabled className="min-h-11 w-full rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-500">الاشتراك قريبًا</button>}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-gray-200 p-5">
          <h3 className="font-bold">رصيد قراءة إضافي — قريبًا</h3>
          <p className="mt-2 text-sm leading-7">{OCR_TOP_UP.pages} صفحة مقابل {OCR_TOP_UP.price} ريالًا، صالحة لمدة {OCR_TOP_UP.validityMonths} شهرًا من الشراء. الإعداد الفردي وإدخال البيانات خدمة منفصلة عن الاشتراك.</p>
        </div>
        <ul className="mt-5 space-y-2 text-xs leading-6 text-gray-600">
          <li>الأسعار المقترحة قبل أي ضريبة واجبة التطبيق؛ سيظهر الإجمالي شاملًا الضريبة قبل الدفع عند تفعيله.</li>
          <li>الصورة صفحة واحدة، وPDF يُحسب بعدد صفحاته. يظهر الرصيد المطلوب قبل القراءة، وإعادة المحاولة بسبب خلل النظام لا تخصم رصيدًا إضافيًا.</li>
          <li>الرصيد الشهري لا يتراكم، ويتجدد شهريًا حتى مع الاشتراك السنوي. القراءة تجهّز مسودة للمراجعة؛ المخزون يتحدث بعد اعتمادك.</li>
          <li>عند تفعيل الحدود، انتهاء رصيد القراءة يبقي الإدخال اليدوي متاحًا. بلوغ حد الفواتير لا يمنع قراءة السجلات أو تحصيل الفواتير القائمة.</li>
          <li>سنعلن موعد تفعيل الاشتراكات وسياسة الانتقال للمستخدمين الحاليين قبل تطبيق الحدود.</li>
        </ul>
      </div>
    </section>
  );
}
