"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Camera, Plus, ShoppingCart } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { formatDate, formatMonthLabel, formatSAR } from "@/lib/format";
import { Purchase, PurchasesSummary } from "@/lib/types";
import { useMonthResource } from "@/lib/use-month-resource";
import EmptyState from "@/components/EmptyState";
import { MonthNav } from "@/components/ui/month-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language";

interface PurchasesPageData {
  purchases: Purchase[];
  summary: PurchasesSummary | null;
}

export default function PurchasesPage() {
  const { language } = useLanguage();
  const {
    month,
    data,
    error,
    isCurrentMonth,
    previousMonth,
    nextMonth,
  } = useMonthResource<PurchasesPageData>({
    load: async (targetMonth) => {
      const [purchases, summary] = await Promise.all([
        apiGet<Purchase[]>(`/purchases?month=${targetMonth}`),
        apiGet<PurchasesSummary>("/purchases/summary").catch(() => null),
      ]);
      return { purchases, summary };
    },
    errorMessage: (err) => err instanceof ApiError ? err.message : language === "ar" ? "تعذر تحميل المشتريات" : "Could not load purchases",
  });

  const filtered = data?.purchases ?? null;
  const summary = data?.summary ?? null;

  const monthTotal = useMemo(
    () => (filtered ?? []).reduce((s, p) => s + p.total, 0),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">
          {language === "ar" ? "المشتريات" : "Purchases"}
        </h1>
        <div className="flex gap-2">
          <Link
            href="/purchases/scan"
            aria-label={language === "ar" ? "تصوير فاتورة شراء" : "Scan purchase invoice"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 shadow-sm active:bg-brand-100"
          >
            <Camera className="h-5 w-5" />
          </Link>
          <Link
            href="/purchases/new"
            aria-label={language === "ar" ? "شراء جديد" : "New purchase"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm active:bg-brand-800"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Summary: month stepper + total in one card (matches invoices) */}
      <section className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
        <MonthNav month={month} isCurrentMonth={isCurrentMonth} onPrev={previousMonth} onNext={nextMonth} className="border-0 shadow-none bg-transparent px-0 py-0" />

        {filtered && filtered.length > 0 && (
          <div className="mt-1 flex items-baseline justify-between border-t border-gray-100 px-1 pt-3">
            <span className="text-sm font-medium text-gray-500">
              {language === "ar" ? `إجمالي ${filtered.length} عملية شراء` : `${filtered.length} purchases`}
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-amber-700">
              {formatSAR(monthTotal, language)}
            </span>
          </div>
        )}
      </section>

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-2xl">
          <AlertDescription className="text-red-600 font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Top suppliers (all-time) */}
      {summary && summary.bySupplier.length > 0 && (
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold text-gray-700">
            {language === "ar" ? "أكثر الموردين" : "Top suppliers"}
          </h2>
          <ul className="flex flex-col gap-2">
            {summary.bySupplier.slice(0, 3).map((s) => (
              <li key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {s.name}
                  <span className="ms-1.5 text-xs text-gray-500">({s.count})</span>
                </span>
                <span className="font-bold text-gray-900">{formatSAR(s.total, language)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!filtered && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title={language === "ar" ? `ما في مشتريات في ${formatMonthLabel(month, language)}` : `No purchases in ${formatMonthLabel(month, language)}`}
          description={language === "ar" ? "سجّل مشترياتك يدويًا أو صوّر فاتورة الشراء" : "Record purchases manually or scan the supplier invoice."}
          actionLabel={language === "ar" ? "تسجيل شراء" : "Record purchase"}
          actionHref="/purchases/new"
        />
      )}

      {filtered && filtered.length > 0 && (
        <ul className="flex flex-col gap-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {p.supplier?.name ?? (language === "ar" ? "بدون مورد" : "No supplier")}
                    </span>
                    {p.source === "OCR" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                        <Camera className="h-3 w-3" aria-hidden="true" />
                        {language === "ar" ? "من صورة" : "Scanned"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600">
                    {formatDate(p.date)} · {language === "ar" ? `${p.items.length} صنف` : `${p.items.length} items`}
                  </span>
                  {p.items.length > 0 && (
                    <span className="truncate text-xs text-gray-500">
                      {p.items.slice(0, 2).map((i) => i.name).join(language === "ar" ? "، " : ", ")}
                      {p.items.length > 2 && (language === "ar" ? ` و${p.items.length - 2} أخرى` : ` and ${p.items.length - 2} more`)}
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-bold text-gray-900">
                  {formatSAR(p.total, language)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
