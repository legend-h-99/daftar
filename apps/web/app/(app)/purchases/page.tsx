"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, ChevronLeft, ChevronRight, Plus, ShoppingCart } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { currentMonthStr, formatDate, formatMonthLabel, formatSAR, shiftMonth, toMonthStr } from "@/lib/format";
import { Purchase, PurchasesSummary } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PurchasesPage() {
  const [month, setMonth] = useState(currentMonthStr());
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [summary, setSummary] = useState<PurchasesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCurrentMonth = month === currentMonthStr();

  useEffect(() => {
    apiGet<Purchase[]>("/purchases")
      .then(setPurchases)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "تعذر تحميل المشتريات"),
      );
    apiGet<PurchasesSummary>("/purchases/summary").then(setSummary).catch(() => {});
  }, []);

  const filtered = useMemo(
    () => purchases?.filter((p) => p.date && toMonthStr(p.date) === month) ?? null,
    [purchases, month],
  );

  const monthTotal = useMemo(
    () => (filtered ?? []).reduce((s, p) => s + p.total, 0),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">المشتريات</h1>
        <div className="flex gap-2">
          <Link
            href="/purchases/scan"
            aria-label="تصوير فاتورة شراء"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 shadow-sm active:bg-brand-100"
          >
            <Camera className="h-5 w-5" />
          </Link>
          <Link
            href="/purchases/new"
            aria-label="شراء جديد"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm active:bg-brand-800"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
          aria-label="الشهر السابق"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-gray-800">{formatMonthLabel(month)}</span>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={isCurrentMonth}
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:bg-gray-100 disabled:opacity-30"
          aria-label="الشهر التالي"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Month total */}
      {filtered && filtered.length > 0 && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-amber-800">
              إجمالي {formatMonthLabel(month)}
            </span>
            <span className="text-lg font-extrabold text-amber-900">
              {formatSAR(monthTotal)}
            </span>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-2xl">
          <AlertDescription className="text-red-600 font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Top suppliers (all-time) */}
      {summary && summary.bySupplier.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold text-gray-700">
            أكثر الموردين
          </h2>
          <ul className="flex flex-col gap-2">
            {summary.bySupplier.slice(0, 3).map((s) => (
              <li key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {s.name}
                  <span className="ms-1.5 text-xs text-gray-500">({s.count})</span>
                </span>
                <span className="font-bold text-gray-900">{formatSAR(s.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!purchases && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title={`ما في مشتريات في ${formatMonthLabel(month)}`}
          description="سجّل مشترياتك يدويًا أو صوّر فاتورة الشراء"
          actionLabel="تسجيل شراء"
          actionHref="/purchases/new"
        />
      )}

      {filtered && filtered.length > 0 && (
        <ul className="flex flex-col gap-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {p.supplier?.name ?? "بدون مورد"}
                    </span>
                    {p.source === "OCR" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                        <Camera className="h-3 w-3" aria-hidden="true" />
                        من صورة
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600">
                    {formatDate(p.date)} · {p.items.length} صنف
                  </span>
                  {p.items.length > 0 && (
                    <span className="truncate text-xs text-gray-500">
                      {p.items.slice(0, 2).map((i) => i.name).join("، ")}
                      {p.items.length > 2 && ` و${p.items.length - 2} أخرى`}
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-bold text-gray-900">
                  {formatSAR(p.total)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
