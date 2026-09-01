"use client";

import Link from "next/link";
import {
  PiggyBank,
  Users,
  Boxes,
  ChevronLeft,
  ChevronRight,
  BarChart2,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { formatSAR, formatDate, formatMonthLabel, roundQty } from "@/lib/format";
import { DashboardSummary, UNIT_LABELS } from "@/lib/types";
import { useMonthResource } from "@/lib/use-month-resource";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language";

// Module-level cache keyed by month — survives client-side navigation,
// implements stale-while-revalidate (1-minute TTL).
// Capped at 6 entries (via cacheMax in useMonthResource) to prevent unbounded memory growth.
const STALE_MS = 60_000;
const summaryCache: Map<string, { data: DashboardSummary; ts: number }> = new Map();

export default function DashboardPage() {
  const { language } = useLanguage();
  const {
    month,
    data: summary,
    error,
    loading,
    isCurrentMonth,
    previousMonth,
    nextMonth,
    reload,
  } = useMonthResource<DashboardSummary>({
    load: (targetMonth) => apiGet<DashboardSummary>(`/dashboard/summary?month=${targetMonth}`),
    errorMessage: (err) => err instanceof ApiError ? err.message : language === "ar" ? "تعذر تحميل البيانات" : "Could not load data",
    cache: summaryCache,
    staleMs: STALE_MS,
  });

  return (
    <div className="flex flex-col gap-6">

      {/* Header + month navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">
            {language === "ar" ? "الرئيسية" : "Dashboard"}
          </h1>
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={previousMonth}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition active:bg-gray-100"
              aria-label={language === "ar" ? "الشهر السابق" : "Previous month"}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[100px] text-center text-sm text-gray-500">
              {formatMonthLabel(month, language)}
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition active:bg-gray-100 disabled:opacity-30"
              aria-label={language === "ar" ? "الشهر التالي" : "Next month"}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <Link
          href="/reports"
          className="flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 transition active:bg-gray-200"
          aria-label={language === "ar" ? "عرض التقرير الكامل" : "View full report"}
        >
          <BarChart2 className="h-4 w-4" aria-hidden="true" />
          {language === "ar" ? "التقارير" : "Reports"}
        </Link>
      </div>

      <div aria-live="polite">

        {/* Skeleton */}
        {loading && (
          <div role="status" aria-label={language === "ar" ? "جاري تحميل البيانات" : "Loading data"} className="flex flex-col gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <div className="flex gap-3">
              <Skeleton className="h-24 flex-1 rounded-2xl" />
              <Skeleton className="h-24 flex-1 rounded-2xl" />
            </div>
            <Skeleton className="h-28 rounded-2xl" />
            <div className="flex flex-col gap-2 pt-1">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <Alert variant="destructive" className="animate-scale-in rounded-xl border-red-200 bg-red-50 gap-2">
            <AlertDescription className="font-medium text-red-600">{error}</AlertDescription>
            <button
              onClick={reload}
              className="text-xs font-semibold text-red-700 underline underline-offset-2"
            >
              {language === "ar" ? "حاول مرة ثانية" : "Try again"}
            </button>
          </Alert>
        )}

        {/* Data */}
        {summary && !loading && (
          <div className="flex flex-col gap-4">

            {/* Hero: صافي الربح — the one number that answers "how am I doing?" */}
            {(() => {
              const positive = summary.netProfit >= 0;
              const ledger = [
                { label: language === "ar" ? "المبيعات" : "Sales", value: summary.totalSales, dot: "bg-brand-500", text: "text-brand-700" },
                { label: language === "ar" ? "تكلفة البيع" : "Cost of sales", value: summary.costOfGoodsSold, dot: "bg-amber-500", text: "text-amber-700" },
                { label: language === "ar" ? "مصاريف" : "Expenses", value: summary.operatingExpenses, dot: "bg-red-500", text: "text-red-600" },
              ];
              return (
                <section
                  aria-label={`${language === "ar" ? "صافي الربح" : "Net profit"} ${formatSAR(summary.netProfit, language)}`}
                  className={`animate-fade-up rounded-lg border p-5 shadow-sm ${
                    positive ? "border-brand-100 bg-brand-50" : "border-red-100 bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-500">
                      {language === "ar" ? "صافي الربح" : "Net profit"} · {formatMonthLabel(month, language)}
                    </span>
                    <span
                      className={`rounded-xl p-2 ${
                        positive ? "bg-brand-100 text-brand-700" : "bg-red-100 text-red-600"
                      }`}
                    >
                      <PiggyBank className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                    </span>
                  </div>

                  <AnimatedCounter
                    to={summary.netProfit}
                    format={(amount) => formatSAR(amount, language)}
                    className={`mt-2 block text-4xl font-extrabold tracking-tight ${
                      positive ? "text-brand-700" : "text-red-600"
                    }`}
                  />

                  {/* Inline ledger — the دفتر breakdown behind the number */}
                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-black/[0.06] pt-4">
                    {ledger.map((row) => (
                      <div key={row.label} className="flex flex-col gap-1">
                        <dt className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                          <span className={`h-1.5 w-1.5 rounded-full ${row.dot}`} aria-hidden="true" />
                          {row.label}
                        </dt>
                        <dd className={`text-sm font-bold tracking-tight ${row.text}`}>
                          {formatSAR(row.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })()}

            {/* Low stock alert */}
            {summary.lowStock && summary.lowStock.length > 0 && (
              <Link
                href="/inventory"
                className="animate-fade-up flex flex-col gap-2 rounded-2xl bg-amber-50 px-4 py-3.5 transition active:bg-amber-100"
                style={{ animationDelay: "240ms" }}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                  <Boxes className="h-4 w-4" aria-hidden="true" />
                  {language === "ar" ? "مخزون منخفض — يحتاج إعادة طلب" : "Low stock needs reorder"}
                </span>
                <span className="text-xs text-amber-700">
                  {summary.lowStock
                    .slice(0, 3)
                    .map((m) => `${m.name} (${roundQty(m.stockQty, 2)} ${UNIT_LABELS[m.unit]})`)
                    .join(" · ")}
                  {summary.lowStock.length > 3
                    ? language === "ar"
                      ? ` و${summary.lowStock.length - 3} أصناف أخرى`
                      : ` and ${summary.lowStock.length - 3} more`
                    : ""}
                </span>
              </Link>
            )}

            {/* Unpaid invoices */}
            <section
              className="animate-fade-up"
              style={{ animationDelay: "280ms" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-base font-bold text-gray-900">
                  <Users className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  {language === "ar" ? "لي عند الزباين" : "Customer balances"}
                </h2>
                {summary.unpaidInvoicesCount > 0 && (
                  <span className="text-sm font-bold text-red-600">
                    {formatSAR(summary.unpaidInvoicesTotal, language)}
                  </span>
                )}
              </div>

              {summary.unpaidInvoices.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={language === "ar" ? "ولا فاتورة غير مدفوعة" : "No unpaid invoices"}
                  description={language === "ar" ? "كل زباينك سدّدوا فواتيرهم، عاش!" : "All customer invoices are settled."}
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {summary.unpaidInvoices.map((inv, i) => (
                    <li key={inv.id} className="animate-fade-up" style={{ animationDelay: `${320 + i * 50}ms` }}>
                      <Link
                        href={`/invoices/${inv.id}`}
                        aria-label={`${language === "ar" ? "فاتورة" : "Invoice"} ${inv.number}, ${inv.customerName || (language === "ar" ? "زبون بدون اسم" : "Unnamed customer")}, ${formatSAR(inv.total, language)}`}
                        className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3.5 shadow-sm transition active:bg-gray-50"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate font-semibold text-gray-900">
                            {inv.customerName || (language === "ar" ? "زبون بدون اسم" : "Unnamed customer")}
                          </span>
                          <span className="text-xs text-gray-500">
                            {language === "ar" ? "فاتورة" : "Invoice"} {inv.number}
                            {inv.dueDate ? ` · ${language === "ar" ? "تستحق" : "due"} ${formatDate(inv.dueDate)}` : ""}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="font-bold text-gray-900">
                            {formatSAR(inv.total, language)}
                          </span>
                          <StatusBadge status={inv.status} />
                        </div>
                        <ChevronLeft className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {summary.unpaidInvoicesCount > summary.unpaidInvoicesLimitedTo && (
                <div className="mt-2 text-center">
                  <Link href="/invoices" className="text-xs text-brand-700 underline">
                    {language === "ar" ? "عرض جميع الفواتير" : "View all invoices"} ({summary.unpaidInvoicesCount})
                  </Link>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
