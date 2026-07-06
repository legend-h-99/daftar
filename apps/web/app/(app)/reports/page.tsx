"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  PiggyBank,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Wallet,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { formatSAR, currentMonthStr, formatMonthLabel } from "@/lib/format";
import { DashboardSummary } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function CostBar({
  sales,
  purchases,
  expenses,
}: {
  sales: number;
  purchases: number;
  expenses: number;
}) {
  const totalCosts = purchases + expenses;
  const isLoss = totalCosts > sales;
  const base = Math.max(sales, totalCosts) || 1;

  const salesW = Math.round((sales / base) * 100);
  const purchasesW = Math.round((purchases / base) * 100);
  const expensesW = Math.round((expenses / base) * 100);

  return (
    <div className="flex flex-col gap-2">
      {/* Sales bar */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-right text-xs text-gray-400">مبيعات</span>
        <div className="flex h-7 flex-1 overflow-hidden rounded-lg bg-gray-100">
          <div
            className="flex items-center justify-end rounded-lg bg-brand-500 px-2 transition-all"
            style={{ width: `${salesW}%` }}
          >
            {salesW > 15 && (
              <span className="text-[10px] font-bold text-white">{formatSAR(sales)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Purchases bar */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-right text-xs text-gray-400">مشتريات</span>
        <div className="flex h-7 flex-1 overflow-hidden rounded-lg bg-gray-100">
          <div
            className="flex items-center justify-end rounded-lg bg-amber-400 px-2 transition-all"
            style={{ width: `${purchasesW}%` }}
          >
            {purchasesW > 15 && (
              <span className="text-[10px] font-bold text-amber-900">{formatSAR(purchases)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Expenses bar */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-right text-xs text-gray-400">مصاريف</span>
        <div className="flex h-7 flex-1 overflow-hidden rounded-lg bg-gray-100">
          <div
            className="flex items-center justify-end rounded-lg bg-red-400 px-2 transition-all"
            style={{ width: `${expensesW}%` }}
          >
            {expensesW > 15 && (
              <span className="text-[10px] font-bold text-white">{formatSAR(expenses)}</span>
            )}
          </div>
        </div>
      </div>

      {isLoss && (
        <p className="text-center text-xs font-medium text-red-500">
          التكاليف تتجاوز المبيعات — خسارة هذا الشهر
        </p>
      )}
    </div>
  );
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
          const totalCosts = summary.totalPurchases + summary.totalExpenses;
          const marginPct = summary.totalSales > 0
            ? pct(summary.netProfit, summary.totalSales)
            : 0;

          return (
            <div className="flex flex-col gap-3">

              {/* Net profit hero */}
              <div
                className={`flex flex-col gap-1 rounded-2xl px-5 py-5 ${
                  isProfit
                    ? "bg-brand-700 text-white"
                    : "bg-red-600 text-white"
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

              {/* P&L statement */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    قائمة الأرباح والخسائر
                  </h2>
                </div>

                {/* Sales row */}
                <div className="flex items-center justify-between px-4 py-3.5 bg-brand-50/50">
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
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
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
                      {pct(summary.totalPurchases, summary.totalSales)}%
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
                      {pct(summary.totalExpenses, summary.totalSales)}%
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

              {/* Quick links */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { href: "/invoices", label: "الفواتير", icon: FileText, color: "text-brand-700 bg-brand-50" },
                  { href: "/purchases", label: "المشتريات", icon: ShoppingCart, color: "text-amber-700 bg-amber-50" },
                  { href: "/expenses", label: "المصاريف", icon: Wallet, color: "text-red-600 bg-red-50" },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-3 shadow-sm active:bg-gray-50"
                  >
                    <span className={`rounded-lg p-1.5 ${color}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold text-gray-600">{label}</span>
                  </Link>
                ))}
              </div>

            </div>
          );
        })()}
      </div>
    </div>
  );
}
