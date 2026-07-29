"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, MessageCircle, Users } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { formatSAR, formatDate, normalizeSaudiPhone } from "@/lib/format";
import { Invoice } from "@/lib/types";
import { useBusiness } from "@/lib/business-context";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CustomerGroup {
  key: string;
  customerName: string;
  phone: string | null;
  invoices: Invoice[];
  totalOwed: number;
}

function daysOverdue(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

function remaining(inv: Invoice): number {
  return inv.status === "PARTIAL" && inv.paidAmount != null
    ? inv.total - inv.paidAmount
    : inv.total;
}

function buildReminderMsg(group: CustomerGroup, businessName: string): string {
  if (group.invoices.length === 1) {
    const inv = group.invoices[0];
    return `السلام عليكم، هذا تذكير بفاتورة رقم ${inv.number} من ${businessName} بقيمة ${remaining(inv).toFixed(2)} ر.س. شكراً لك 🙏`;
  }
  const nums = group.invoices.map((inv) => `#${inv.number}`).join(" و");
  return `السلام عليكم، هذا تذكير بفواتير ${nums} من ${businessName} بإجمالي ${group.totalOwed.toFixed(2)} ر.س. شكراً لك 🙏`;
}

export default function LiEndPage() {
  const { business } = useBusiness();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Invoice[]>("/invoices")
      .then((data) => { if (!cancelled) setInvoices(data); })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "تعذر تحميل الفواتير");
      });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo<CustomerGroup[]>(() => {
    if (!invoices) return [];
    const debt = invoices.filter(
      (inv) => inv.status === "UNPAID" || inv.status === "PARTIAL",
    );
    const map = new Map<string, CustomerGroup>();
    for (const inv of debt) {
      const key = inv.customer?.id ?? `anon-${inv.customer?.name ?? "unknown"}`;
      const owed = remaining(inv);
      if (!map.has(key)) {
        map.set(key, {
          key,
          customerName: inv.customer?.name || "زبون بدون اسم",
          phone: inv.customer?.phone ?? null,
          invoices: [],
          totalOwed: 0,
        });
      }
      const g = map.get(key)!;
      g.invoices.push(inv);
      g.totalOwed += owed;
    }
    return [...map.values()].sort((a, b) => b.totalOwed - a.totalOwed);
  }, [invoices]);

  const grandTotal = useMemo(
    () => groups.reduce((s, g) => s + g.totalOwed, 0),
    [groups],
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-extrabold text-gray-900">لي عند الزباين</h1>

      {groups.length > 0 && (
        <section
          aria-label={`إجمالي لك عند الزباين ${formatSAR(grandTotal)}`}
          className="rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-500">
              إجمالي لك عند {groups.length} من الزباين
            </span>
            <span className="rounded-xl bg-red-100 p-2 text-red-600">
              <Users className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
          </div>
          <span className="mt-1 block text-4xl font-extrabold tracking-tight text-red-600">
            {formatSAR(grandTotal)}
          </span>
        </section>
      )}

      {error && (
        <Alert variant="destructive" className="rounded-2xl bg-red-50 border-red-200">
          <AlertDescription className="text-red-600 font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {!invoices && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {invoices && groups.length === 0 && (
        <EmptyState
          icon={Users}
          title="ولا زبون عليه شي"
          description="عاش! كل زباينك سدّدوا فواتيرهم"
          actionLabel="إضافة فاتورة"
          actionHref="/invoices/new"
        />
      )}

      {groups.length > 0 && (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => {
            const phone = group.phone ? normalizeSaudiPhone(group.phone) : "";
            const msg = buildReminderMsg(group, business?.name || "دفتر");
            const waHref = phone
              ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
              : `https://wa.me/?text=${encodeURIComponent(msg)}`;

            return (
              <li
                key={group.key}
                className="flex flex-col gap-0 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
              >
                {/* Customer header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-gray-900">{group.customerName}</span>
                    {group.phone && (
                      <span className="text-xs text-gray-500" dir="ltr">{group.phone}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-lg font-extrabold text-red-600">
                      {formatSAR(group.totalOwed)}
                    </span>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`إرسال تذكير لـ ${group.customerName} عبر واتساب`}
                      className="flex items-center gap-1 rounded-xl border border-[#25D366] px-2.5 py-1 text-xs font-semibold text-[#25D366] active:bg-green-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      تذكير
                    </a>
                  </div>
                </div>

                {/* Invoice lines */}
                <div className="border-t border-gray-100">
                  {group.invoices.map((inv) => {
                    const overdue = daysOverdue(inv.dueDate);
                    const owed = remaining(inv);
                    return (
                      <Link
                        key={inv.id}
                        href={`/invoices/${inv.id}`}
                        className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 border-b border-gray-50 last:border-b-0"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-sm text-gray-700">
                            فاتورة {inv.number}
                          </span>
                          <div className="flex items-center gap-2">
                            {(inv.issueDate || inv.createdAt) && (
                              <span className="text-xs text-gray-400">
                                {formatDate(inv.issueDate || inv.createdAt)}
                              </span>
                            )}
                            {overdue !== null && (
                              <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                                متأخرة {overdue} {overdue === 1 ? "يوم" : "أيام"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-bold text-gray-900">
                            {formatSAR(owed)}
                          </span>
                          <StatusBadge status={inv.status} />
                        </div>
                        <ChevronLeft className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
