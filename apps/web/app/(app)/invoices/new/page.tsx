"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { DEMO_MODE } from "@/lib/demo-api";
import { Customer, Invoice, InvoiceItem, Product } from "@/lib/types";
import { useBusiness } from "@/lib/business-context";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";
import InvoiceCustomerField from "@/components/invoices/InvoiceCustomerField";
import InvoiceItemsEditor from "@/components/invoices/InvoiceItemsEditor";
import InvoiceSummary from "@/components/invoices/InvoiceSummary";
import { useLanguage } from "@/lib/language";

// The form opens with one empty line so an invoice can be written straight
// away, without first creating a product to pick from.
const blankLine = (): InvoiceItem => ({ name: "", unitPrice: 0, quantity: 1 });
const isBlank = (item: InvoiceItem) => !item.productId && !item.name.trim() && !item.unitPrice;

export default function NewInvoicePage() {
  const router = useRouter();
  const { business } = useBusiness();
  const { language } = useLanguage();
  const en = language === "en";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [items, setItems] = useState<InvoiceItem[]>(() => [blankLine()]);

  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Reused when saving is retried, so a request whose response was lost
  // returns the original invoice instead of creating a duplicate.
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    apiGet<Customer[]>("/customers").then(setCustomers).catch((err) => {
      setError(err instanceof ApiError ? err.message : en ? "Could not load customers" : "تعذر تحميل العملاء");
    });
    apiGet<Product[]>("/products").then(setProducts).catch((err) => {
      setError(err instanceof ApiError ? err.message : en ? "Could not load products" : "تعذر تحميل المنتجات");
    });
  }, [en]);

  function selectCustomer(c: Customer) {
    setError(null);
    setSelectedCustomer(c);
    setCustomerQuery(c.name);
  }

  function clearCustomer() {
    setError(null);
    setSelectedCustomer(null);
    setCustomerQuery("");
  }

  function addProductLine(product: Product) {
    setError(null);
    // A picked product takes the place of any untouched empty line.
    setItems((prev) => [
      ...prev.filter((item) => !isBlank(item)),
      {
        productId: product.id,
        name: product.name,
        unitPrice: product.sellingPrice,
        quantity: 1,
      },
    ]);
  }

  function addBlankLine() {
    setError(null);
    setItems((prev) => [...prev, blankLine()]);
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setError(null);
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
    track("workflow_started", { workflow: "invoice" });
    const lines = items.filter((item) => !isBlank(item));
    if (lines.length === 0 || lines.some((item) => !item.name.trim())) {
      track("workflow_failed", { workflow: "invoice", status: 400 });
      setError(
        lines.length === 0
          ? en ? "Write the item name and its price" : "اكتب اسم الصنف وسعره"
          : en ? "Write a name for every item" : "اكتب اسم كل صنف",
      );
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
        // Keep the new customer selected so a retry reuses it instead of adding another.
        setSelectedCustomer(created);
        setCustomers((prev) => [...prev, created]);
      }

      const invoice = await apiPost<Invoice>("/invoices", {
        customerId,
        items: lines.map((item) => ({
          productId: item.productId || undefined,
          name: item.name.trim(),
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
        status: "UNPAID",
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      }, { headers: { "Idempotency-Key": idempotencyKey.current } });
      track("invoice_created", { items_count: lines.length });
      router.push(DEMO_MODE ? "/invoices/list?created=1" : `/invoices/detail/view?id=${encodeURIComponent(invoice.id)}`);
    } catch (err) {
      track("workflow_failed", { workflow: "invoice", status: err instanceof ApiError ? err.status : 0 });
      // A 4xx answer means nothing was saved; the next attempt is a new invoice.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) idempotencyKey.current = crypto.randomUUID();
      setError(err instanceof ApiError ? err.message : en ? "Could not create invoice" : "تعذر إنشاء الفاتورة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/invoices/list"
          aria-label={en ? "Back" : "رجوع"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600"
        >
          {en ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900">{en ? "New invoice" : "فاتورة جديدة"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InvoiceCustomerField
          customers={customers}
          query={customerQuery}
          selected={selectedCustomer}
          onQueryChange={(value) => {
            setError(null);
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
          onAddBlank={addBlankLine}
          onUpdate={updateItem}
          onRemove={removeItem}
        />

        {/* Due date */}
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <label htmlFor="invoice-due-date" className="mb-1.5 block text-sm font-semibold text-gray-700">
            {en ? "Due date" : "تاريخ الاستحقاق"}{" "}
            <span className="font-normal text-gray-500">{en ? "(optional)" : "(اختياري)"}</span>
          </label>
          <input
            id="invoice-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); setError(null); }}
            className={fieldClass}
          />
        </div>

        {/* Notes */}
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <label htmlFor="invoice-notes" className="mb-1.5 block text-sm font-semibold text-gray-700">
            {en ? "Notes" : "ملاحظات"} <span className="font-normal text-gray-500">{en ? "(optional)" : "(اختياري)"}</span>
          </label>
          <textarea
            id="invoice-notes"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setError(null); }}
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
            {saving ? (en ? "Saving..." : "جاري الحفظ...") : (en ? "Save invoice" : "حفظ الفاتورة")}
        </button>
      </form>
    </div>
  );
}
