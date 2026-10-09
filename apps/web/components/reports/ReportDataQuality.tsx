import Link from "next/link";
import { DashboardSummary } from "@/lib/types";

export default function ReportDataQuality({ summary, en }: { summary: DashboardSummary; en: boolean }) {
  if (!summary.costEstimated && !summary.missingCostItems) return null;
  return <aside role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
    <p>{en ? "Review costs before relying on this profit" : "راجع التكاليف قبل الاعتماد على الربح"}</p>
    {summary.costEstimated && <p>{en ? "Some historical sale costs use current material prices." : "بعض تكاليف البيع القديمة تقديرية باستخدام سعر المادة الحالي."}</p>}
    {!!summary.missingCostItems && <p>{en ? `${summary.missingCostItems} sale lines have missing or incomplete inventory-linked costs. Product overhead is not included in inventory cost; record it as an expense without double counting.` : `${summary.missingCostItems} بنود بيع لها تكاليف ناقصة أو لا يغطيها المخزون بالكامل. تكاليف المنتج الإضافية لا تدخل ضمن تكلفة المخزون؛ سجّلها كمصروف دون احتسابها مرتين.`}</p>}
    <Link href="/products" className="mt-2 inline-flex min-h-11 items-center font-semibold underline">{en ? "Review product recipes" : "راجع وصفات المنتجات"}</Link>
  </aside>;
}
