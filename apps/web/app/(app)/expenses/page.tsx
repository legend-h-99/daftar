"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Wallet } from "lucide-react";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import { currentMonthStr, formatDate, formatMonthLabel, formatSAR } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS, Expense } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ui/form-field";
import AddExpenseSheet from "@/components/expenses/AddExpenseSheet";

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ExpensesPage() {
  const [month, setMonth] = useState(currentMonthStr());
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function loadExpenses() {
    setExpenses(null);
    apiGet<Expense[]>(`/expenses?month=${month}`)
      .then(setExpenses)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "تعذر تحميل المصاريف");
      });
  }

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const total = useMemo(
    () => (expenses || []).reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  async function handleDelete(id: string) {
    if (!confirm("متأكد إنك تبي تحذف هذا المصروف؟")) return;
    try {
      await apiDelete(`/expenses/${id}`);
      loadExpenses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر حذف المصروف");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">المصاريف</h1>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm active:bg-brand-800"
          aria-label="إضافة مصروف"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
          aria-label="الشهر السابق"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-gray-800">
          {formatMonthLabel(month)}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
          aria-label="الشهر التالي"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {expenses && expenses.length > 0 && (
        <div className="rounded-2xl bg-brand-900 px-4 py-3.5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm text-brand-100">
              إجمالي مصاريف {formatMonthLabel(month)}
            </span>
            <span className="text-lg font-extrabold">{formatSAR(total)}</span>
          </div>
        </div>
      )}

      {error && (
        <ErrorAlert>{error}</ErrorAlert>
      )}

      {!expenses && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {expenses && expenses.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="لا توجد مصاريف مسجلة"
          description="سجّل مصاريف محلك عشان تعرف صافي ربحك بدقة"
          actionLabel="إضافة مصروف"
          onAction={() => setShowForm(true)}
        />
      )}

      {expenses && expenses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {expenses.map((exp) => (
            <li
              key={exp.id}
              className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-900">
                  {EXPENSE_CATEGORY_LABELS[exp.category]}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(exp.date)}
                  {exp.note ? ` · ${exp.note}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-900">
                  {formatSAR(exp.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(exp.id)}
                  aria-label="حذف"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 active:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <AddExpenseSheet
          onClose={() => setShowForm(false)}
          onSaved={loadExpenses}
        />
      )}
    </div>
  );
}
