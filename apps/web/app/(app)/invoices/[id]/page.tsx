"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, MessageCircle, CheckCircle2 } from "lucide-react";
import { apiGet, apiGetBlob, apiPatch, ApiError } from "@/lib/api";
import { formatSAR, formatDate, normalizeSaudiPhone } from "@/lib/format";
import { Invoice } from "@/lib/types";
import { useBusiness } from "@/lib/business-context";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { business } = useBusiness();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    return apiGet<Invoice>(`/invoices/${params.id}`)
      .then(setInvoice)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "تعذر تحميل الفاتورة");
      });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function markAsPaid() {
    if (!invoice) return;
    setUpdating(true);
    try {
      const updated = await apiPatch<Invoice>(
        `/invoices/${invoice.id}/status`,
        { status: "PAID" },
      );
      setInvoice(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحديث الحالة");
    } finally {
      setUpdating(false);
    }
  }

  if (error && !invoice) {
    return (
      <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-xl">
        <AlertDescription className="text-red-600 font-medium">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!invoice) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  const statusLabel =
    invoice.status === "PAID"
      ? "مدفوعة"
      : invoice.status === "PARTIAL"
        ? "جزئي"
        : "غير مدفوعة";

  const waText = `فاتورة رقم ${invoice.number} من ${business?.name || "دفتر"}\nالإجمالي: ${formatSAR(invoice.total)}\nالحالة: ${statusLabel}`;
  const waPhone = invoice.customer?.phone
    ? normalizeSaudiPhone(invoice.customer.phone)
    : "";
  const waHref = `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`;

  async function downloadPdf() {
    if (!invoice || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await apiGetBlob(`/invoices/${invoice.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `فاتورة-${invoice.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل الملف");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-lg font-extrabold text-gray-900">
              {business?.name || "دفتر"}
            </p>
            <p className="text-xs text-gray-500">
              فاتورة رقم {invoice.number}
            </p>
            {invoice.createdAt && (
              <p className="text-xs text-gray-500">
                {formatDate(invoice.createdAt)}
              </p>
            )}
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        {invoice.customer && (
          <div className="mb-4 rounded-xl bg-gray-50 px-3.5 py-3">
            <p className="text-xs text-gray-500">الزبون</p>
            <p className="font-semibold text-gray-900">
              {invoice.customer.name}
            </p>
          </div>
        )}

        <div className="flex flex-col divide-y divide-gray-100">
          {invoice.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {item.name}
                </p>
                <p className="text-xs text-gray-500">
                  {item.quantity} × {formatSAR(item.unitPrice)}
                </p>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {formatSAR(item.unitPrice * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1.5 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>المجموع الفرعي</span>
            <span>{formatSAR(invoice.subtotal)}</span>
          </div>
          {invoice.vatAmount > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>ضريبة القيمة المضافة</span>
              <span>{formatSAR(invoice.vatAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5">
            <span className="text-sm font-bold text-gray-900">الإجمالي</span>
            <span className="text-xl font-extrabold text-gray-900">
              {formatSAR(invoice.total)}
            </span>
          </div>
        </div>

        {invoice.dueDate && (
          <p className="mt-3 text-xs text-gray-500">
            تاريخ الاستحقاق: {formatDate(invoice.dueDate)}
          </p>
        )}
        {invoice.notes && (
          <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {invoice.notes}
          </p>
        )}
      </div>

      {invoice.status !== "PAID" && (
        <button
          type="button"
          onClick={markAsPaid}
          disabled={updating}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white active:bg-brand-800 disabled:opacity-60"
        >
          <CheckCircle2 className="h-5 w-5" />
          {updating ? "جاري التحديث..." : 'تحديد كـ"مدفوعة"'}
        </button>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={downloading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 active:bg-gray-50 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {downloading ? "جاري التحميل..." : "تحميل PDF"}
        </button>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-green-500 py-3 text-sm font-semibold text-white active:bg-green-600"
        >
          <MessageCircle className="h-4 w-4" />
          مشاركة عبر واتساب
        </a>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-xl">
          <AlertDescription className="text-red-600 font-medium">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
