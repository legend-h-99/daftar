import {
  PiggyBank,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatSAR, percentOf } from "@/lib/format";
import { DashboardSummary } from "@/lib/types";

/** قائمة الأرباح والخسائر: مبيعات ناقص تكاليف = صافي الربح. */
export default function ProfitLossStatement({
  summary,
}: {
  summary: DashboardSummary;
}) {
  const totalCosts = summary.totalPurchases + summary.totalExpenses;
  const isProfit = summary.netProfit >= 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-900">
          قائمة الأرباح والخسائر
        </h2>
      </div>

      {/* Sales row */}
      <div className="flex items-center justify-between bg-brand-50/50 px-4 py-3.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100">
            <TrendingUp className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
          </span>
          المبيعات
        </span>
        <span className="text-base font-extrabold text-brand-700">
          {formatSAR(summary.totalSales)}
        </span>
      </div>

      <div className="px-4 pt-3 pb-1">
        <span className="text-xs font-semibold text-gray-500">
          التكاليف
        </span>
      </div>

      {/* Purchases row */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-gray-600">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
            <ShoppingCart className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
          </span>
          المشتريات
          <span className="text-xs text-amber-600">
            {percentOf(summary.totalPurchases, summary.totalSales)}%
          </span>
        </span>
        <span className="font-semibold text-amber-700">
          ({formatSAR(summary.totalPurchases)})
        </span>
      </div>

      {/* Expenses row */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-gray-600">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100">
            <TrendingDown className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
          </span>
          المصاريف التشغيلية
          <span className="text-xs text-red-500">
            {percentOf(summary.totalExpenses, summary.totalSales)}%
          </span>
        </span>
        <span className="font-semibold text-red-600">
          ({formatSAR(summary.totalExpenses)})
        </span>
      </div>

      {/* Total costs subtotal */}
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
        <span className="text-xs font-semibold text-gray-500">إجمالي التكاليف</span>
        <span className="text-sm font-bold text-gray-700">
          ({formatSAR(totalCosts)})
        </span>
      </div>

      {/* Net profit */}
      <div
        className={`flex items-center justify-between px-4 py-4 ${
          isProfit ? "bg-brand-50" : "bg-red-50"
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              isProfit ? "bg-brand-100" : "bg-red-100"
            }`}
          >
            <PiggyBank
              className={`h-3.5 w-3.5 ${isProfit ? "text-brand-700" : "text-red-600"}`}
              aria-hidden="true"
            />
          </span>
          صافي الربح
        </span>
        <span
          className={`text-lg font-extrabold ${
            isProfit ? "text-brand-700" : "text-red-600"
          }`}
        >
          {formatSAR(summary.netProfit)}
        </span>
      </div>
    </div>
  );
}
