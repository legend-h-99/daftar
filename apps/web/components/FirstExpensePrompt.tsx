"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { track } from "@/lib/analytics";
import AddExpenseSheet from "@/components/expenses/AddExpenseSheet";

/** Only mounted after the business setup has been saved successfully. */
export default function FirstExpensePrompt({ onContinue }: { onContinue: () => void }) {
  const { language } = useLanguage();
  const en = language === "en";
  const [open, setOpen] = useState(false);
  const viewed = useRef(false);
  const clicked = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track("first_expense_prompt_viewed");
  }, []);

  return (
    <main dir={en ? "ltr" : "rtl"} className="flex min-h-screen items-center justify-center bg-[#f7f8f7] px-5 py-12">
      <section aria-labelledby="first-expense-title" className="w-full max-w-md rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
        <CheckCircle2 className="mb-5 h-10 w-10 text-brand-700" aria-hidden="true" />
        <p className="mb-2 text-sm font-semibold text-brand-700">{en ? "Your business is ready" : "نشاطك جاهز"}</p>
        <h1 id="first-expense-title" className="text-2xl font-extrabold text-gray-900">{en ? "Record your first expense" : "سجّل أول مصروف"}</h1>
        <p className="mt-3 text-sm leading-7 text-gray-600">{en ? "Start with a real business expense, such as ingredients or packaging. Choose a category, enter the amount, and save." : "ابدأ بمصروف فعلي لنشاطك، مثل شراء مكونات أو تغليف. اختر الفئة، واكتب المبلغ، ثم احفظ."}</p>
        <button type="button" onClick={() => {
          if (!clicked.current) { clicked.current = true; track("first_expense_prompt_clicked"); }
          setOpen(true);
        }} className="motion-press mt-6 min-h-12 w-full rounded-xl bg-brand-700 px-4 py-3 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          {en ? "Record my first expense" : "سجّل أول مصروف"}
        </button>
        <button type="button" onClick={() => { track("first_expense_prompt_skipped"); onContinue(); }} className="mt-2 min-h-12 w-full rounded-xl px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          {en ? "Later — go to dashboard" : "لاحقًا، انتقل للرئيسية"}
        </button>
      </section>
      {open && <AddExpenseSheet onClose={() => setOpen(false)} onSaved={() => {
        track("first_expense_completed");
        onContinue();
      }} />}
    </main>
  );
}
