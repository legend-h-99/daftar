"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, ListChecks } from "lucide-react";
import { useLanguage } from "@/lib/language";

/** Safe fallback while invoice OCR is unavailable: no invoice image is uploaded. */
export default function ScanPurchasePage() {
  const { language } = useLanguage();
  const en = language === "en";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/purchases"
          aria-label={en ? "Back" : "رجوع"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600"
        >
          {en ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">
            {en ? "Enter a purchase from its invoice" : "أدخل الشراء من الفاتورة"}
          </h1>
          <p className="text-xs text-gray-500">
            {en ? "A simple alternative while automatic reading is unavailable" : "طريقة بديلة وبسيطة إلى أن تتوفر القراءة التلقائية"}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="font-bold text-gray-900">
          {en ? "Automatic invoice reading is currently off" : "قراءة الفاتورة آليًا غير مفعّلة حاليًا"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          {en
            ? "Keep the invoice open as a reference and enter the supplier, date, items, quantities, and unit prices. Your photo stays on your device; this page does not upload it."
            : "افتح الفاتورة بجانبك وأدخل اسم المورد والتاريخ والأصناف والكميات وسعر الوحدة. تبقى الصورة على جهازك؛ هذه الصفحة لا ترفعها للخادم."}
        </p>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
          <ListChecks className="h-5 w-5 text-brand-700" aria-hidden="true" />
          {en ? "What to enter" : "البيانات المطلوبة"}
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-gray-600">
          <li>{en ? "Supplier and invoice date" : "المورد وتاريخ الفاتورة"}</li>
          <li>{en ? "Each item and its quantity" : "كل صنف وكميته"}</li>
          <li>{en ? "Unit price; the total updates automatically" : "سعر الوحدة؛ والإجمالي يُحسب تلقائيًا"}</li>
        </ul>
      </section>

      <Link
        href="/purchases/new"
        className="motion-press flex min-h-12 items-center justify-center rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white"
      >
        {en ? "Enter purchase manually" : "إدخال الشراء يدويًا"}
      </Link>
    </div>
  );
}
