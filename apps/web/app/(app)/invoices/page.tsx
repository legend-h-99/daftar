"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { currentMonthStr, formatDate, formatMonthLabel, formatSAR, shiftMonth, toMonthStr } from "@/lib/format";
import { Invoice } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

type FilterTab = "ALL" | "UNPAID" | "PARTIAL";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "الكل" },
  { key: "UNPAID", label: "غير مدفوعة" },
  { key: "PARTIAL", label: "جزئي" },
];

export default function InvoicesPage() {
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [month, setMonth] = useState(currentMonthStr());
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCurrentMonth = month === currentMonthStr();

  useEffect(() => {
    let cancelled = false;
    setInvoices(null);
    apiGet<Invoice[]>("/invoices")
      .then((data) => { if (!cancelled) setInvoices(data); })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "تعذر تحميل الفواتير");
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!invoices) return null;
    return invoices.filter((inv) => {
      const dateStr = inv.issueDate || inv.createdAt;
      const matchMonth = !dateStr || toMonthStr(dateStr) === month;
      const matchTab = tab === "ALL" || inv.status === tab;
      return matchMonth && matchTab;
    });
  }, [invoices, month, tab]);

  const monthTotal = useMemo(
    () => (filtered ?? []).reduce((s, inv) => s + inv.total, 0),
    [filtered],
  );

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

      {/* Status tabs */}
      <div className="flex gap-1.5 rounded-2xl bg-gray-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
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
        <div className="rounded-2xl bg-brand-50 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-brand-800">
              إجمالي {formatMonthLabel(month)}
            </span>
            <span className="text-lg font-extrabold text-brand-700">
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

      {!invoices && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <EmptyState
          icon={FileText}
          title={tab === "ALL" ? `ما في فواتير في ${formatMonthLabel(month)}` : "لا توجد فواتير بهذا الفلتر"}
          description="أنشئ أول فاتورة لك وابدأ تتابع مبيعاتك"
          actionLabel="إضافة فاتورة"
          actionHref="/invoices/new"
        />
      )}

      {filtered && filtered.length > 0 && (
        <ul className="flex flex-col gap-2">
          {filtered.map((inv) => {
            const remaining =
              inv.status === "PARTIAL" && inv.paidAmount != null
                ? inv.total - inv.paidAmount
                : null;
            return (
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
                    <span className="text-xs text-gray-600">
                      فاتورة {inv.number}
                      {(inv.issueDate || inv.createdAt)
                        ? ` · ${formatDate(inv.issueDate || inv.createdAt)}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-bold text-gray-900">
                      {formatSAR(inv.total)}
                    </span>
                    <StatusBadge status={inv.status} />
                    {remaining != null && remaining > 0 && (
                      <span className="text-xs font-semibold text-yellow-700">
                        متبقي {formatSAR(remaining)}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
