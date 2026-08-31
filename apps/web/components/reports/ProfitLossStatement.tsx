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
  const totalCosts = summary.costOfGoodsSold + summary.operatingExpenses;
  const isProfit = summary.netProfit >= 0;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-foreground">
          قائمة الأرباح والخسائر
        </h2>
      </div>

      {/* Sales row */}
      <div className="flex items-center justify-between bg-accent/50 px-4 py-3.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
            <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          </span>
          المبيعات
        </span>
        <span className="text-base font-extrabold text-primary">
          {formatSAR(summary.totalSales)}
        </span>
      </div>

      <div className="px-4 pt-3 pb-1">
        <span className="text-xs font-semibold text-muted-foreground">
          التكاليف
        </span>
      </div>

      {/* Cost of goods sold row */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
            <ShoppingCart className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          </span>
          تكلفة المخزون المباع
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {percentOf(summary.costOfGoodsSold, summary.totalSales)}%
          </span>
        </span>
        <span className="font-semibold text-amber-700 dark:text-amber-400">
          ({formatSAR(summary.costOfGoodsSold)})
        </span>
      </div>

      {/* Expenses row */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
            <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden="true" />
          </span>
          المصاريف التشغيلية
          <span className="text-xs text-red-500 dark:text-red-400">
            {percentOf(summary.operatingExpenses, summary.totalSales)}%
          </span>
        </span>
        <span className="font-semibold text-red-600 dark:text-red-400">
          ({formatSAR(summary.operatingExpenses)})
        </span>
      </div>

      {/* Total costs subtotal */}
      <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5">
        <span className="text-xs font-semibold text-muted-foreground">إجمالي التكاليف</span>
        <span className="text-sm font-bold text-foreground">
          ({formatSAR(totalCosts)})
        </span>
      </div>

      {/* Net profit */}
      <div
        className={`flex items-center justify-between px-4 py-4 ${
          isProfit ? "bg-accent/60" : "bg-red-50 dark:bg-red-950/40"
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              isProfit ? "bg-accent" : "bg-red-100 dark:bg-red-900"
            }`}
          >
            <PiggyBank
              className={`h-3.5 w-3.5 ${isProfit ? "text-primary" : "text-red-600 dark:text-red-400"}`}
              aria-hidden="true"
            />
          </span>
          صافي الربح
        </span>
        <span
          className={`text-lg font-extrabold ${
            isProfit ? "text-primary" : "text-red-600 dark:text-red-400"
          }`}
        >
          {formatSAR(summary.netProfit)}
        </span>
      </div>
    </div>
  );
}
