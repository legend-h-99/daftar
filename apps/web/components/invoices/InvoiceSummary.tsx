import { formatSAR } from "@/lib/format";
import { useLanguage } from "@/lib/language";

/** بطاقة ملخّص الفاتورة: المجموع الفرعي + الضريبة (إن فُعّلت) + الإجمالي. */
export default function InvoiceSummary({
  subtotal,
  vatAmount,
  total,
  vatEnabled,
}: {
  subtotal: number;
  vatAmount: number;
  total: number;
  vatEnabled: boolean;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  return (
    <div className="rounded-lg bg-brand-900 p-5 text-white shadow-sm">
      <div className="flex items-center justify-between text-sm text-brand-100">
        <span>{en ? "Subtotal" : "المجموع الفرعي"}</span>
        <span className="font-semibold">{formatSAR(subtotal, language)}</span>
      </div>
      {vatEnabled && (
        <div className="mt-1.5 flex items-center justify-between text-sm text-brand-100">
          <span>{en ? "VAT (15%)" : "ضريبة القيمة المضافة (15%)"}</span>
          <span className="font-semibold">{formatSAR(vatAmount, language)}</span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-brand-700 pt-3">
        <span className="text-sm text-brand-200">{en ? "Total" : "الإجمالي"}</span>
        <span className="text-2xl font-extrabold">{formatSAR(total, language)}</span>
      </div>
    </div>
  );
}
