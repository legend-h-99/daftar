"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { Customer, Invoice, InvoiceItem, Product } from "@/lib/types";
import { useBusiness } from "@/lib/business-context";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";
import InvoiceCustomerField from "@/components/invoices/InvoiceCustomerField";
import InvoiceItemsEditor from "@/components/invoices/InvoiceItemsEditor";
import InvoiceSummary from "@/components/invoices/InvoiceSummary";

export default function NewInvoicePage() {
  const router = useRouter();
  const { business } = useBusiness();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<Customer[]>("/customers").then(setCustomers).catch(() => {});
    apiGet<Product[]>("/products").then(setProducts).catch(() => {});
  }, []);

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerQuery(c.name);
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
        <InvoiceCustomerField
          customers={customers}
          query={customerQuery}
          selected={selectedCustomer}
          onQueryChange={(value) => {
            setCustomerQuery(value);
            setSelectedCustomer(null);
          }}
          onSelect={selectCustomer}
          onClear={clearCustomer}
        />

        <InvoiceItemsEditor
          items={items}
          products={products}
          onAdd={addProductLine}
          onUpdate={updateItem}
          onRemove={removeItem}
        />

        {/* Due date */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            تاريخ الاستحقاق{" "}
            <span className="font-normal text-gray-500">(اختياري)</span>
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={fieldClass}
          />
        </div>

        {/* Notes */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            ملاحظات <span className="font-normal text-gray-500">(اختياري)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={cn(fieldClass, "resize-none")}
          />
        </div>

        <InvoiceSummary
          subtotal={subtotal}
          vatAmount={vatAmount}
          total={total}
          vatEnabled={!!business?.vatEnabled}
        />

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
