"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Wallet } from "lucide-react";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import { currentMonthStr, formatDate, formatMonthLabel, formatSAR } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS, Expense } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isCurrentMonth = month === currentMonthStr();

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

  // Group expenses by category for the breakdown
  const byCategory = useMemo(() => {
    if (!expenses || expenses.length === 0) return [];
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({
        category: cat as keyof typeof EXPENSE_CATEGORY_LABELS,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));
  }, [expenses, total]);

  async function handleDelete(id: string) {
    if (deletingId === id) {
      // Second tap — confirm delete
      try {
        await apiDelete(`/expenses/${id}`);
        setDeletingId(null);
        loadExpenses();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "تعذر حذف المصروف");
        setDeletingId(null);
      }
    } else {
      setDeletingId(id);
    }
  }

  return (
    <div className="flex flex-col gap-4" onClick={() => setDeletingId(null)}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">المصاريف</h1>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowForm(true); }}
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
          disabled={isCurrentMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 active:bg-gray-100 disabled:opacity-30"
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
          {byCategory.length > 1 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {byCategory.map(({ category, amount, pct }) => (
                <div key={category} className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-white/20 flex-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-[110px] shrink-0 text-right text-xs text-brand-100">
                    {EXPENSE_CATEGORY_LABELS[category]}
                  </span>
                  <span className="w-[70px] shrink-0 text-right text-xs font-semibold text-white">
                    {formatSAR(amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-2xl">
          <AlertDescription className="text-red-600 font-medium">{error}</AlertDescription>
        </Alert>
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
              onClick={(e) => e.stopPropagation()}
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
                  aria-label={deletingId === exp.id ? "تأكيد الحذف" : "حذف"}
                  className={`flex h-8 items-center justify-center rounded-lg px-2 text-sm font-semibold transition-all active:scale-95 ${
                    deletingId === exp.id
                      ? "bg-red-600 text-white"
                      : "bg-red-50 text-red-500 active:bg-red-100"
                  }`}
                >
                  {deletingId === exp.id ? (
                    "تأكيد"
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
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
