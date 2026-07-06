"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ShoppingCart,
  Users,
  Boxes,
  ChevronLeft,
  ChevronRight,
  BarChart2,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { formatSAR, formatDate, currentMonthStr, formatMonthLabel, roundQty } from "@/lib/format";
import { DashboardSummary, UNIT_LABELS } from "@/lib/types";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
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
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "تعذر تحميل البيانات");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, retryKey]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header + month navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">الرئيسية</h1>
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition active:bg-gray-100"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[100px] text-center text-sm text-gray-500">
              {formatMonthLabel(month)}
            </span>
            <button
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={isCurrentMonth}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition active:bg-gray-100 disabled:opacity-30"
              aria-label="الشهر التالي"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <Link
          href="/reports"
          className="flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 active:bg-gray-200"
          aria-label="عرض التقرير الكامل"
        >
          <BarChart2 className="h-4 w-4" aria-hidden="true" />
          التقارير
        </Link>
      </div>

      <div aria-live="polite">
        {loading && (
          <div
            role="status"
            aria-label="جاري تحميل البيانات"
            className="flex flex-col gap-3"
          >
            <Skeleton className="h-24 rounded-2xl" />
            <div className="flex gap-3">
              <Skeleton className="h-24 flex-1 rounded-2xl" />
              <Skeleton className="h-24 flex-1 rounded-2xl" />
            </div>
            <Skeleton className="h-28 rounded-2xl" />
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

        {summary && !loading && (
          <div className="flex flex-col gap-4">
            {/* Stats: sales full-width, purchases+expenses side-by-side, net profit hero */}
            <div className="flex flex-col gap-3">
              <StatCard
                label="المبيعات"
                value={formatSAR(summary.totalSales)}
                icon={TrendingUp}
                tone="brand"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <StatCard
                    label="المشتريات"
                    value={formatSAR(summary.totalPurchases)}
                    icon={ShoppingCart}
                    tone="amber"
                  />
                </div>
                <div className="flex-1">
                  <StatCard
                    label="المصاريف"
                    value={formatSAR(summary.totalExpenses)}
                    icon={TrendingDown}
                    tone="red"
                  />
                </div>
              </div>
              <StatCard
                label="صافي الربح"
                value={formatSAR(summary.netProfit)}
                icon={PiggyBank}
                tone={summary.netProfit >= 0 ? "brand" : "red"}
                hero
              />
            </div>

            {/* Low stock alert */}
            {summary.lowStock && summary.lowStock.length > 0 && (
              <Link
                href="/inventory"
                className="flex flex-col gap-2 rounded-2xl bg-amber-50 px-4 py-3.5 active:bg-amber-100"
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                  <Boxes className="h-4 w-4" aria-hidden="true" />
                  مخزون منخفض — يحتاج إعادة طلب
                </span>
                <span className="text-xs text-amber-700">
                  {summary.lowStock
                    .slice(0, 3)
                    .map(
                      (m) =>
                        `${m.name} (${roundQty(m.stockQty, 2)} ${UNIT_LABELS[m.unit]})`,
                    )
                    .join(" · ")}
                  {summary.lowStock.length > 3
                    ? ` و${summary.lowStock.length - 3} أصناف أخرى`
                    : ""}
                </span>
              </Link>
            )}

            {/* Unpaid invoices */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-base font-bold text-gray-900">
                  <Users className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  لي عند الزباين
                </h2>
                {summary.unpaidInvoicesCount > 0 && (
                  <span className="text-sm font-bold text-red-600">
                    {formatSAR(summary.unpaidInvoicesTotal)}
                  </span>
                )}
              </div>

              {summary.unpaidInvoices.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="ولا فاتورة غير مدفوعة"
                  description="كل زباينك سدّدوا فواتيرهم، عاش!"
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {summary.unpaidInvoices.map((inv) => (
                    <li key={inv.id}>
                      <Link
                        href={`/invoices/${inv.id}`}
                        aria-label={`فاتورة ${inv.number}، ${inv.customerName || "زبون بدون اسم"}، ${formatSAR(inv.total)}`}
                        className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm active:bg-gray-50"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate font-semibold text-gray-900">
                            {inv.customerName || "زبون بدون اسم"}
                          </span>
                          <span className="text-xs text-gray-500">
                            فاتورة {inv.number}
                            {inv.dueDate ? ` · تستحق ${formatDate(inv.dueDate)}` : ""}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="font-bold text-gray-900">
                            {formatSAR(inv.total)}
                          </span>
                          <StatusBadge status={inv.status} />
                        </div>
                        <ChevronLeft className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
