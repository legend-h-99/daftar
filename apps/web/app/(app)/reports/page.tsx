"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import {
  formatSAR,
  formatMonthLabel,
  percentOf,
} from "@/lib/format";
import { DashboardSummary, Expense, EXPENSE_CATEGORY_LABELS } from "@/lib/types";
import { useMonthResource } from "@/lib/use-month-resource";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CostBar from "@/components/reports/CostBar";
import ProfitLossStatement from "@/components/reports/ProfitLossStatement";
import ReportQuickLinks from "@/components/reports/ReportQuickLinks";

interface ReportsPageData {
  summary: DashboardSummary;
  expenses: Expense[];
}

export default function ReportsPage() {
  const {
    month,
    data,
    error,
    loading,
    isCurrentMonth,
    previousMonth,
    nextMonth,
    reload,
  } = useMonthResource<ReportsPageData>({
    load: async (targetMonth) => {
      const [summary, expenses] = await Promise.all([
        apiGet<DashboardSummary>(`/dashboard/summary?month=${targetMonth}`),
        apiGet<Expense[]>(`/expenses?month=${targetMonth}`),
      ]);
      return { summary, expenses };
    },
    errorMessage: (err) => err instanceof ApiError ? err.message : "تعذر تحميل البيانات",
  });

  const summary = data?.summary ?? null;
  const expenses = data?.expenses ?? [];

  const expenseByCategory = useMemo(() => {
    if (!expenses.length) return [];
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({
        category: cat as keyof typeof EXPENSE_CATEGORY_LABELS,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));
  }, [expenses]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="رجوع"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex flex-1 items-center justify-between">
          <h1 className="text-xl font-extrabold text-gray-900">التقارير</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={previousMonth}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[80px] text-center text-sm font-medium text-gray-600">
              {formatMonthLabel(month)}
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 active:bg-gray-100 disabled:opacity-30"
              aria-label="الشهر التالي"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div aria-live="polite">
        {loading && (
          <div role="status" aria-label="جاري تحميل التقرير" className="flex flex-col gap-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        )}

        {error && !loading && (
          <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-xl gap-2">
            <AlertDescription className="text-red-600 font-medium">{error}</AlertDescription>
            <button
              onClick={reload}
              className="text-xs font-semibold text-red-700 underline underline-offset-2"
            >
              حاول مرة ثانية
            </button>
          </Alert>
        )}

        {summary && !loading && (() => {
          const isProfit = summary.netProfit >= 0;
          const marginPct = percentOf(summary.netProfit, summary.totalSales);

          return (
            <div className="flex flex-col gap-3">
              {/* Net profit hero — same language as the dashboard hero (white/wash, never solid brand) */}
              <div
                className={`flex flex-col gap-1 rounded-lg border p-5 shadow-sm ${
                  isProfit ? "border-brand-100 bg-brand-50" : "border-red-100 bg-red-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-500">
                    صافي الربح · {formatMonthLabel(month)}
                  </span>
                  <span
                    className={`rounded-xl p-2 ${
                      isProfit ? "bg-brand-100 text-brand-700" : "bg-red-100 text-red-600"
                    }`}
                  >
                    <PiggyBank className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                  </span>
                </div>
                <span
                  className={`mt-1 text-4xl font-extrabold tracking-tight ${
                    isProfit ? "text-brand-700" : "text-red-600"
                  }`}
                >
                  {formatSAR(summary.netProfit)}
                </span>
                <span className="text-sm text-gray-500">
                  {isProfit
                    ? `هامش الربح ${marginPct}% من المبيعات`
                    : `التكاليف تتجاوز المبيعات بـ ${formatSAR(Math.abs(summary.netProfit))}`}
                </span>
              </div>

              {/* Bar chart */}
              <div className="rounded-lg border border-gray-100 bg-white px-4 py-4 shadow-sm">
                <h2 className="mb-4 text-sm font-bold text-gray-900">
                  مقارنة بصرية
                </h2>
                <CostBar
                  sales={summary.totalSales}
                  purchases={summary.costOfGoodsSold}
                  expenses={summary.operatingExpenses}
                />
              </div>

              <ProfitLossStatement summary={summary} />

              {/* Expense breakdown by category */}
              {expenseByCategory.length > 0 && (
                <div className="rounded-lg border border-gray-100 bg-white px-4 py-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-bold text-gray-900">
                    تفصيل المصاريف
                  </h2>
                  <div className="flex flex-col gap-2.5">
                    {expenseByCategory.map(({ category, amount, pct }) => (
                      <div key={category}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700">
                            {EXPENSE_CATEGORY_LABELS[category]}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {formatSAR(amount)}
                            <span className="mr-1.5 text-xs font-normal text-gray-400">
                              {pct}%
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-brand-600 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ReportQuickLinks />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
