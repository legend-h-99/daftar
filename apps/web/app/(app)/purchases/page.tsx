"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Plus, ShoppingCart } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { formatDate, formatMonthLabel, formatSAR } from "@/lib/format";
import { Purchase, PurchasesSummary } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ui/form-field";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [summary, setSummary] = useState<PurchasesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Purchase[]>("/purchases")
      .then(setPurchases)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "تعذر تحميل المشتريات"),
      );
    apiGet<PurchasesSummary>("/purchases/summary").then(setSummary).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">المشتريات</h1>
        <div className="flex gap-2">
          <Link
            href="/purchases/scan"
            aria-label="تصوير فاتورة شراء"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm active:bg-gray-50"
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

      {error && (
        <ErrorAlert>{error}</ErrorAlert>
      )}

      {summary && summary.bySupplier.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-700">أعلى الموردين</h2>
          <ul className="flex flex-col gap-2">
            {summary.bySupplier.slice(0, 3).map((s) => (
              <li key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {s.name}
                  <span className="mr-1.5 text-xs text-gray-500">
                    ({s.count} فاتورة)
                  </span>
                </span>
                <span className="font-bold text-gray-900">{formatSAR(s.total)}</span>
              </li>
            ))}
          </ul>
          {summary.byMonth.length > 0 && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
              مشتريات {formatMonthLabel(summary.byMonth[0].month)}:{" "}
              <span className="font-bold text-gray-600">
                {formatSAR(summary.byMonth[0].total)}
              </span>
            </p>
          )}
        </div>
      )}

      {!purchases && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {purchases && purchases.length === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title="ما سجلت أي مشتريات"
          description="سجّل مشترياتك يدويًا أو صوّر فاتورة الشراء — والمخزون يتحدث تلقائيًا"
          actionLabel="تسجيل شراء"
          actionHref="/purchases/new"
        />
      )}

      {purchases && purchases.length > 0 && (
        <ul className="flex flex-col gap-2">
          {purchases.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      شراء رقم {p.number}
                    </span>
                    {p.source === "OCR" && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                        📷 من صورة
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {p.supplier?.name ?? "بدون مورد"} · {formatDate(p.date)} ·{" "}
                    {p.items.length} صنف
                  </span>
                </div>
                <span className="font-bold text-gray-900">{formatSAR(p.total)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
