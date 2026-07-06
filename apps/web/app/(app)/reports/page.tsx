"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import {
  formatSAR,
  currentMonthStr,
  formatMonthLabel,
  percentOf,
} from "@/lib/format";
import { DashboardSummary } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CostBar from "@/components/reports/CostBar";
import ProfitLossStatement from "@/components/reports/ProfitLossStatement";
import ReportQuickLinks from "@/components/reports/ReportQuickLinks";

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonthStr());
  const [retryKey, setRetryKey] = useState(0);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth = month === currentMonthStr();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSummary(null);
    apiGet<DashboardSummary>(`/dashboard/summary?month=${month}`)
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "تعذر تحميل البيانات");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, retryKey]);

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
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[80px] text-center text-sm font-medium text-gray-600">
              {formatMonthLabel(month)}
            </span>
            <button
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
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
              onClick={() => setRetryKey((k) => k + 1)}
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
              {/* Net profit hero */}
              <div
                className={`flex flex-col gap-1 rounded-2xl px-5 py-5 ${
                  isProfit ? "bg-brand-700 text-white" : "bg-red-600 text-white"
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-widest opacity-70">
                  صافي الربح
                </span>
                <span className="text-4xl font-extrabold tracking-tight">
                  {formatSAR(summary.netProfit)}
                </span>
                <span className="text-sm opacity-80">
                  {isProfit
                    ? `هامش الربح ${marginPct}% من المبيعات`
                    : `التكاليف تتجاوز المبيعات بـ ${formatSAR(Math.abs(summary.netProfit))}`}
                </span>
              </div>

              {/* Bar chart */}
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  مقارنة بصرية
                </h2>
                <CostBar
                  sales={summary.totalSales}
                  purchases={summary.totalPurchases}
                  expenses={summary.totalExpenses}
                />
              </div>

              <ProfitLossStatement summary={summary} />

              <ReportQuickLinks />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
