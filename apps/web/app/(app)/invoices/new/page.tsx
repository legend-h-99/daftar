"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { formatSAR } from "@/lib/format";
import { Customer, Invoice, InvoiceItem, Product } from "@/lib/types";
import { useBusiness } from "@/lib/business-context";

export default function NewInvoicePage() {
  const router = useRouter();
  const { business } = useBusiness();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerList, setShowCustomerList] = useState(false);

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<Customer[]>("/customers").then(setCustomers).catch(() => {});
    apiGet<Product[]>("/products").then(setProducts).catch(() => {});
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!customerQuery.trim()) return customers.slice(0, 6);
    const q = customerQuery.trim();
    return customers.filter((c) => c.name.includes(q)).slice(0, 6);
  }, [customers, customerQuery]);

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerQuery(c.name);
    setShowCustomerList(false);
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setCustomerQuery("");
  }

  function addProductLine(product: Product) {
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        unitPrice: product.sellingPrice,
        quantity: 1,
      },
    ]);
    setShowProductPicker(false);
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const vatAmount = business?.vatEnabled ? subtotal * 0.15 : 0;
  const total = subtotal + vatAmount;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      setError("أضف صنف واحد على الأقل");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let customerId = selectedCustomer?.id;
      if (!customerId && customerQuery.trim()) {
        const created = await apiPost<Customer>("/customers", {
          name: customerQuery.trim(),
        });
        customerId = created.id;
      }

      const invoice = await apiPost<Invoice>("/invoices", {
        customerId,
        items: items.map((item) => ({
          productId: item.productId || undefined,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
        status: "UNPAID",
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر إنشاء الفاتورة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">فاتورة جديدة</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Customer */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            الزبون <span className="font-normal text-gray-500">(اختياري)</span>
          </label>
          <div className="relative">
            <UserPlus className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setSelectedCustomer(null);
                setShowCustomerList(true);
              }}
              onFocus={() => setShowCustomerList(true)}
              placeholder="اكتب اسم الزبون أو اختر من القائمة"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-4 pr-10 text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600"
            />
            {customerQuery && (
              <button
                type="button"
                onClick={clearCustomer}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                aria-label="مسح"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {showCustomerList && filteredCustomers.length > 0 && (
            <ul className="mt-2 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
              {filteredCustomers.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full px-3 py-2.5 text-right text-sm text-gray-700 active:bg-gray-50"
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!selectedCustomer && customerQuery.trim() && (
            <p className="mt-1.5 text-xs text-gray-500">
              سيتم إضافة "{customerQuery.trim()}" كزبون جديد
            </p>
          )}
        </div>

        {/* Items */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">الأصناف</h3>
            <button
              type="button"
              onClick={() => setShowProductPicker((v) => !v)}
              className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700"
            >
              <Search className="h-3.5 w-3.5" />
              اختر منتج
            </button>
          </div>

          {showProductPicker && (
            <ul className="mb-3 flex max-h-48 flex-col divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-100">
              {products.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-gray-500">
                  لا يوجد منتجات مضافة بعد
                </li>
              )}
              {products.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProductLine(p)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-right text-sm active:bg-gray-50"
                  >
                    <span className="text-gray-800">{p.name}</span>
                    <span className="text-gray-500">
                      {formatSAR(p.sellingPrice)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {items.length === 0 ? (
            <p className="text-xs text-gray-500">لم تضف أي صنف بعد</p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input
                      value={item.name}
                      onChange={(e) =>
                        updateItem(index, { name: e.target.value })
                      }
                      className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      aria-label="حذف"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 active:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <label className="text-[11px] font-medium text-gray-500">
                        سعر الوحدة
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={item.unitPrice || ""}
                        onChange={(e) =>
                          updateItem(index, {
                            unitPrice: Number(e.target.value) || 0,
                          })
                        }
                        className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-brand-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(index, {
                            quantity: Math.max(1, item.quantity - 1),
                          })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-700 active:bg-gray-300"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-gray-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(index, { quantity: item.quantity + 1 })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-700 active:bg-gray-300"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-left text-xs font-semibold text-gray-500">
                    الإجمالي: {formatSAR(item.unitPrice * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Due date & notes */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            تاريخ الاستحقاق{" "}
            <span className="font-normal text-gray-500">(اختياري)</span>
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600"
          />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            ملاحظات <span className="font-normal text-gray-500">(اختياري)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600"
          />
        </div>

        {/* Summary */}
        <div className="rounded-2xl bg-brand-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-sm text-brand-100">
            <span>المجموع الفرعي</span>
            <span className="font-semibold">{formatSAR(subtotal)}</span>
          </div>
          {business?.vatEnabled && (
            <div className="mt-1.5 flex items-center justify-between text-sm text-brand-100">
              <span>ضريبة القيمة المضافة (15%)</span>
              <span className="font-semibold">{formatSAR(vatAmount)}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-brand-700 pt-3">
            <span className="text-sm text-brand-200">الإجمالي</span>
            <span className="text-2xl font-extrabold">{formatSAR(total)}</span>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition active:bg-brand-800 disabled:opacity-60"
        >
          {saving ? "جاري الحفظ..." : "حفظ الفاتورة"}
        </button>
      </form>
    </div>
  );
}
