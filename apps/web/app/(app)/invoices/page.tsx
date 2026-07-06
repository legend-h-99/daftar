"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, FileText, Plus } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { formatSAR, formatDate } from "@/lib/format";
import { Invoice, InvoiceStatus } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ui/form-field";

type FilterTab = "ALL" | "UNPAID";

export default function InvoicesPage() {
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInvoices(null);
    const path = tab === "UNPAID" ? "/invoices?status=UNPAID" : "/invoices";
    apiGet<Invoice[]>(path)
      .then((data) => {
        if (!cancelled) setInvoices(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "تعذر تحميل الفواتير");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">الفواتير</h1>
        <Link
          href="/invoices/new"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm active:bg-brand-800"
          aria-label="إضافة فاتورة"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </div>

      <div className="flex gap-2 rounded-2xl bg-gray-100 p-1">
        {(
          [
            { key: "ALL", label: "الكل" },
            { key: "UNPAID", label: "غير مدفوعة" },
          ] as { key: FilterTab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-white text-brand-700 shadow-sm"
                : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <ErrorAlert>{error}</ErrorAlert>
      )}

      {!invoices && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {invoices && invoices.length === 0 && (
        <EmptyState
          icon={FileText}
          title="لا توجد فواتير"
          description="أنشئ أول فاتورة لك وابدأ تتابع مبيعاتك"
          actionLabel="إضافة فاتورة"
          actionHref="/invoices/new"
        />
      )}

      {invoices && invoices.length > 0 && (
        <ul className="flex flex-col gap-2">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                aria-label={`فاتورة ${inv.number}، ${inv.customer?.name || "بدون زبون"}، ${formatSAR(inv.total)}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm active:bg-gray-50"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-semibold text-gray-900">
                    {inv.customer?.name || "بدون زبون"}
                  </span>
                  <span className="text-xs text-gray-500">
                    فاتورة {inv.number}
                    {inv.createdAt ? ` · ${formatDate(inv.createdAt)}` : ""}
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
    </div>
  );
}
