import type { Metadata } from "next";
import Link from "next/link";
import PricingSection from "@/components/pricing/PricingSection";

export const metadata: Metadata = {
  title: "باقات وأسعار دفتر",
  description: "باقات دفتر: البداية مجانًا، أساسي 29 ريالًا، ونمو 49 ريالًا شهريًا. تعرّف على حدود الاستخدام وأرصدة قراءة الفواتير المقترحة.",
};

export default function PlansPage() {
  return <main dir="rtl" className="min-h-screen bg-white">
    <nav aria-label="التنقل" className="mx-auto flex max-w-5xl justify-between px-5 py-4 text-sm font-semibold text-brand-700">
      <Link href="/" className="inline-flex min-h-11 items-center">دفتر — الرئيسية</Link>
      <Link href="/dashboard" className="inline-flex min-h-11 items-center">العودة للتطبيق</Link>
    </nav>
    <h1 className="px-5 pt-4 text-center text-3xl font-extrabold text-gray-900">الباقات والأسعار</h1>
    <PricingSection />
  </main>;
}
