"use client";

import { useState } from "react";

export default function SaleDemo() {
  const [recorded, setRecorded] = useState(false);
  return (
    <section id="how" aria-labelledby="sale-demo-title" className="scroll-mt-20 border-y border-gray-200 bg-white">
      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-12 sm:grid-cols-2 sm:items-center">
        <div>
          <p className="text-sm font-bold text-brand-700">مثال تفاعلي ببيانات افتراضية</p>
          <h2 id="sale-demo-title" className="mt-2 text-2xl font-extrabold">من البيعة إلى الربح</h2>
          <p className="mt-3 text-base leading-8 text-gray-700">بعت علبة معمول بـ100 ريال، وتكلفتها 40 ريالًا؟ سجّل البيعة وشاهد كيف يتغير ربحك.</p>
          <p className="mt-2 text-sm leading-7 text-gray-600">هذا مثال مبسّط. النتيجة الفعلية تعتمد على المبيعات والتكاليف والمصاريف التي تسجلها.</p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-700">قيمة البيعة</dt><dd className="mt-1 text-xl font-bold">100 ريال</dd></div>
            <div><dt className="text-gray-700">تكلفة المنتج</dt><dd className="mt-1 text-xl font-bold">40 ريال</dd></div>
          </dl>
          <p role="status" aria-live="polite" aria-atomic="true" className="mt-5 rounded-xl bg-white p-4 text-base font-bold text-brand-800">{recorded ? "تم تسجيل البيعة في المثال. الربح: 60 ريالًا" : "الربح قبل تسجيل البيعة: 0 ريال"}</p>
          <button type="button" onClick={() => setRecorded(!recorded)} className="mt-4 min-h-11 w-full rounded-xl bg-brand-700 px-4 py-3 font-bold text-white hover:bg-brand-800">{recorded ? "إعادة المثال" : "سجّل البيعة التجريبية"}</button>
          <p className="mt-3 text-sm text-gray-700">للتوضيح فقط؛ لا تُحفظ أي بيانات في حسابك.</p>
        </div>
      </div>
    </section>
  );
}
