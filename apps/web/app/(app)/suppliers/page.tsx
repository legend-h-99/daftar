"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import { Supplier } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SupplierSheet from "@/components/suppliers/SupplierSheet";
import { useLanguage } from "@/lib/language";

export default function SuppliersPage() {
  const { language } = useLanguage();
  const en = language === "en";

  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sheetSupplier, setSheetSupplier] = useState<Supplier | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiGet<Supplier[]>("/suppliers");
      setSuppliers(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : en ? "Could not load suppliers" : "تعذر تحميل الموردين");
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    if (deletingId === id) {
      try {
        await apiDelete(`/suppliers/${id}`);
        setDeletingId(null);
        setActionError(null);
        load();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : en ? "Could not delete supplier" : "تعذر حذف المورد");
        setDeletingId(null);
      }
    } else {
      setDeletingId(id);
    }
  }

  return (
    <div className="flex flex-col gap-4" onClick={() => setDeletingId(null)}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">
          {en ? "Suppliers" : "الموردون"}
        </h1>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSheetSupplier(null); }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm active:bg-brand-800"
          aria-label={en ? "Add supplier" : "إضافة مورد"}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {(loadError || actionError) && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-2xl">
          <AlertDescription className="text-red-600 font-medium">
            {loadError || actionError}
          </AlertDescription>
        </Alert>
      )}

      {suppliers === null && !loadError && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {suppliers !== null && suppliers.length === 0 && (
        <EmptyState
          icon={Truck}
          title={en ? "No suppliers added yet" : "لا يوجد موردون مضافون"}
          description={en ? "Add your suppliers to track purchases by vendor." : "أضف مورديك لمتابعة مشترياتك من كل مورد."}
          actionLabel={en ? "Add supplier" : "إضافة مورد"}
          onAction={() => setSheetSupplier(null)}
        />
      )}

      {suppliers !== null && suppliers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {suppliers.map((s) => (
            <li
              key={s.id}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-gray-900">{s.name}</span>
                {s.phone && (
                  <span className="text-xs text-gray-500">{s.phone}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSheetSupplier(s)}
                  aria-label={en ? "Edit" : "تعديل"}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-gray-500 active:bg-gray-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  aria-label={deletingId === s.id ? (en ? "Confirm delete" : "تأكيد الحذف") : (en ? "Delete" : "حذف")}
                  className={`flex h-8 items-center justify-center rounded-lg px-2 text-sm font-semibold transition-all active:scale-95 ${
                    deletingId === s.id
                      ? "bg-red-600 text-white"
                      : "bg-red-50 text-red-500 active:bg-red-100"
                  }`}
                >
                  {deletingId === s.id ? (en ? "Confirm" : "تأكيد") : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sheetSupplier !== undefined && (
        <SupplierSheet
          supplier={sheetSupplier}
          onClose={() => setSheetSupplier(undefined)}
          onSaved={load}
        />
      )}
    </div>
  );
}
