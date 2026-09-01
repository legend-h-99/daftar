"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, MessageCircle, CheckCircle2, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { apiGet, apiGetBlob, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { fieldClass } from "@/components/ui/form-field";
import { formatSAR, formatDate, normalizeSaudiPhone } from "@/lib/format";
import { Invoice } from "@/lib/types";
import { useBusiness } from "@/lib/business-context";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ui/form-field";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { business } = useBusiness();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPartialForm, setShowPartialForm] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [savingPartial, setSavingPartial] = useState(false);
  const [deletingId, setDeletingId] = useState(false);

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

  async function markAsPartial() {
    if (!invoice) return;
    const amount = parseFloat(partialAmount.replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0 || amount >= invoice.total) {
      setError("أدخل مبلغًا أقل من الإجمالي وأكبر من صفر");
      return;
    }
    setSavingPartial(true);
    setError(null);
    try {
      const updated = await apiPatch<Invoice>(
        `/invoices/${invoice.id}/status`,
        { status: "PARTIAL", paidAmount: amount },
      );
      setInvoice(updated);
      setShowPartialForm(false);
      setPartialAmount("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحديث الحالة");
    } finally {
      setSavingPartial(false);
    }
  }

  function handleDelete() {
    if (!invoice) return;
    if (!deletingId) {
      setDeletingId(true);
      setTimeout(() => setDeletingId(false), 3000);
      return;
    }
    setDeletingId(false);
    apiDelete(`/invoices/${invoice.id}`)
      .then(() => router.replace("/invoices"))
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذر حذف الفاتورة"));
  }

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
      <ErrorAlert>{error}</ErrorAlert>
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
      <div className="flex items-center justify-between">
        <Link
          href="/invoices"
          aria-label="رجوع"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={deletingId ? "تأكيد الحذف" : "حذف الفاتورة"}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
            deletingId
              ? "bg-red-500 text-white"
              : "bg-red-50 text-red-500 active:bg-red-100"
          }`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
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
          <div className="mt-1 flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5">
            <span className="text-sm font-bold text-brand-800">الإجمالي</span>
            <span className="text-2xl font-extrabold tracking-tight text-brand-700">
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
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={markAsPaid}
            disabled={updating}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white active:bg-brand-800 disabled:opacity-60"
          >
            <CheckCircle2 className="h-5 w-5" />
            {updating ? "جاري التحديث..." : 'تحديد كـ"مدفوعة" كاملاً'}
          </button>

          <button
            type="button"
            onClick={() => { setShowPartialForm((v) => !v); setError(null); }}
            className="w-full rounded-lg border border-brand-300 py-3 text-sm font-semibold text-brand-700 active:bg-brand-50"
          >
            تسجيل دفع جزئي
          </button>

          {showPartialForm && (
            <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <label className="text-sm font-semibold text-gray-700">
                المبلغ المدفوع <span className="font-normal text-gray-500">(من {formatSAR(invoice.total)})</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder="0.00"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={markAsPartial}
                disabled={savingPartial || !partialAmount}
                className="w-full rounded-2xl bg-brand-700 py-3 text-sm font-bold text-white active:bg-brand-800 disabled:opacity-60"
              >
                {savingPartial ? "جاري الحفظ..." : "حفظ الدفع الجزئي"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={downloading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 active:bg-gray-50 disabled:opacity-60"
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
        <ErrorAlert>{error}</ErrorAlert>
      )}
    </div>
  );
}
