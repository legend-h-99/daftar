"use client";

import { FormEvent, useState } from "react";
import { apiPost, ApiError } from "@/lib/api";
import {
  EXPENSE_CATEGORY_LABELS,
  ExpenseCategory,
} from "@/lib/types";
import BottomSheet from "@/components/BottomSheet";
import { ErrorAlert, Field, fieldClass } from "@/components/ui/form-field";

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS) as [
  ExpenseCategory,
  string,
][];

/** نافذة تسجيل مصروف جديد. */
export default function AddExpenseSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>("INGREDIENTS");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      setFormError("أدخل مبلغ صحيح");
      return;
    }
    if (!date) {
      setFormError("اختر التاريخ");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiPost("/expenses", {
        category,
        amount: value,
        date,
        note: note.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذر إضافة المصروف");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="مصروف جديد" onClose={onClose}>
      <form onSubmit={handleAdd} className="flex flex-col gap-4">
        <Field label="الفئة" htmlFor="expense-category">
          <select
            id="expense-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className={fieldClass}
          >
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="المبلغ" htmlFor="expense-amount">
          <input
            id="expense-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={fieldClass}
          />
        </Field>

        <Field label="التاريخ" htmlFor="expense-date">
          <input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </Field>

        <Field label="ملاحظة" htmlFor="expense-note" hint="(اختياري)">
          <input
            id="expense-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: فاتورة كهرباء شهر ٧"
            className={fieldClass}
          />
        </Field>

        <ErrorAlert>{formError}</ErrorAlert>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white active:bg-brand-800 disabled:opacity-60"
        >
          {saving ? "جاري الحفظ..." : "حفظ"}
        </button>
      </form>
    </BottomSheet>
  );
}
