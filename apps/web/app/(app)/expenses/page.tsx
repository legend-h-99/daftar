"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Wallet } from "lucide-react";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import { formatDate, formatMonthLabel, formatSAR } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS, Expense } from "@/lib/types";
import { useMonthResource } from "@/lib/use-month-resource";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AddExpenseSheet from "@/components/expenses/AddExpenseSheet";

export default function ExpensesPage() {
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    month,
    data: expenses,
    error: loadError,
    isCurrentMonth,
    previousMonth,
    nextMonth,
    reload,
  } = useMonthResource<Expense[]>({
    load: (targetMonth) => apiGet<Expense[]>(`/expenses?month=${targetMonth}`),
    errorMessage: (err) => err instanceof ApiError ? err.message : "تعذر تحميل المصاريف",
  });

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
        setActionError(null);
        reload();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "تعذر حذف المصروف");
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
          onClick={previousMonth}
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
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 active:bg-gray-100 disabled:opacity-30"
          aria-label="الشهر التالي"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {expenses && expenses.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-500">
              إجمالي مصاريف {formatMonthLabel(month)}
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-red-600">
              {formatSAR(total)}
            </span>
          </div>
          {byCategory.length > 1 && (
            <div className="mt-4 flex flex-col gap-2.5 border-t border-gray-100 pt-4">
              {byCategory.map(({ category, amount, pct }) => (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {EXPENSE_CATEGORY_LABELS[category]}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatSAR(amount)}
                      <span className="mr-1.5 text-xs font-normal text-gray-400">{pct}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(loadError || actionError) && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-2xl">
          <AlertDescription className="text-red-600 font-medium">
            {loadError || actionError}
          </AlertDescription>
        </Alert>
      )}

      {!expenses && !loadError && (
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
          onSaved={reload}
        />
      )}
    </div>
  );
}
