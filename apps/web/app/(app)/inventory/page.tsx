"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Camera,
  ClipboardList,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import { formatDate, formatSAR, roundQty } from "@/lib/format";
import {
  InventoryMaterial,
  MOVEMENT_TYPE_LABELS,
  StockMovement,
  UNIT_LABELS,
} from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ui/form-field";
import AdjustStockSheet from "@/components/inventory/AdjustStockSheet";
import AddMaterialSheet from "@/components/inventory/AddMaterialSheet";

type Tab = "items" | "movements";

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<InventoryMaterial[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [adjusting, setAdjusting] = useState<InventoryMaterial | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    apiGet<InventoryMaterial[]>("/inventory")
      .then(setItems)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "تعذر تحميل المخزون"),
      );
    apiGet<StockMovement[]>("/inventory/movements")
      .then(setMovements)
      .catch(() => {});
  }

  useEffect(load, []);

  function handleDelete(material: InventoryMaterial) {
    if (deletingId !== material.id) {
      setDeletingId(material.id);
      setTimeout(() => setDeletingId((id) => id === material.id ? null : id), 3000);
      return;
    }
    setDeletingId(null);
    apiDelete(`/materials/${material.id}`)
      .then(load)
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذر حذف الصنف"));
  }

  const lowCount = (items ?? []).filter((m) => m.lowStock).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">المخزون</h1>
        <div className="flex gap-2">
          <Link
            href="/products"
            aria-label="المنتجات"
            className="flex h-10 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-sm font-bold text-brand-700 shadow-sm active:bg-brand-100"
          >
            <Package className="h-4 w-4" />
            المنتجات
          </Link>
          <Link
            href="/purchases/scan"
            className="flex h-10 items-center gap-1.5 rounded-full bg-brand-700 px-3.5 text-sm font-bold text-white shadow-sm active:bg-brand-800"
          >
            <Camera className="h-4 w-4" />
            تصوير
          </Link>
        </div>
      </div>

      {lowCount > 0 && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          ⚠️ {lowCount} صنف وصل حد إعادة الطلب — راجع الكميات وأنشئ فاتورة شراء
        </div>
      )}

      <div className="flex rounded-2xl bg-gray-100 p-1">
        {(
          [
            ["items", "الأصناف"],
            ["movements", "سجل الحركات"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition-colors ${
              tab === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ErrorAlert>{error}</ErrorAlert>

      {tab === "items" && (
        <>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-300 py-3 text-sm font-semibold text-gray-500 active:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            إضافة صنف يدويًا
          </button>

          {!items && !error && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          )}

          {items && items.length === 0 && (
            <EmptyState
              icon={Boxes}
              title="ما عندك أصناف في المخزون"
              description="أضف أصنافك بتصوير فاتورة شراء أو بتسجيل شراء يدوي"
              actionLabel="تسجيل شراء"
              actionHref="/purchases/new"
            />
          )}

          {items && items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {items.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{m.name}</span>
                      {m.lowStock && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          منخفض
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      سعر الوحدة {formatSAR(m.unitPrice)}
                      {m.reorderLevel != null &&
                        ` · حد إعادة الطلب ${m.reorderLevel}`}
                    </span>
                    <span className="text-xs text-gray-500">
                      سعر الشراء {formatSAR(m.purchasePrice)} لكل{" "}
                      {roundQty(m.purchaseQty, 2)} {UNIT_LABELS[m.unit]}
                      {m.vatRate > 0
                        ? ` · شامل ضريبة ${m.vatRate}% (${formatSAR(
                            (m.purchasePrice * m.vatRate) / (100 + m.vatRate),
                          )})`
                        : " · بدون ضريبة"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p
                        className={`text-lg font-extrabold ${
                          m.lowStock || m.stockQty <= 0
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {roundQty(m.stockQty)}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {UNIT_LABELS[m.unit]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdjusting(m)}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 active:bg-gray-50"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m)}
                      aria-label={deletingId === m.id ? `تأكيد حذف ${m.name}` : `حذف ${m.name}`}
                      title={deletingId === m.id ? "اضغط مرة ثانية للتأكيد" : ""}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        deletingId === m.id
                          ? "bg-red-500 text-white"
                          : "bg-red-50 text-red-500 active:bg-red-100"
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "movements" && (
        <>
          {movements && movements.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title="لا توجد حركات بعد"
              description="كل شراء أو بيع أو تعديل يدوي ينسجل هنا تلقائيًا"
            />
          )}
          {movements && movements.length > 0 && (
            <ul className="flex flex-col gap-2">
              {movements.map((mv) => {
                const incoming = mv.qty >= 0;
                return (
                  <li
                    key={mv.id}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          incoming
                            ? "bg-green-50 text-green-600"
                            : "bg-red-50 text-red-500"
                        }`}
                      >
                        {incoming ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">
                          {mv.material.name}
                          <span className="mr-1.5 text-xs font-normal text-gray-500">
                            · {MOVEMENT_TYPE_LABELS[mv.type]}
                          </span>
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(mv.createdAt)}
                          {mv.note ? ` · ${mv.note}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-left">
                      <p
                        className={`text-sm font-extrabold ${
                          incoming ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {incoming ? "+" : ""}
                        {roundQty(mv.qty)}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        الرصيد {roundQty(mv.balanceAfter)}{" "}
                        {UNIT_LABELS[mv.material.unit]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {adjusting && (
        <AdjustStockSheet
          material={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={load}
        />
      )}

      {showAdd && (
        <AddMaterialSheet onClose={() => setShowAdd(false)} onSaved={load} />
      )}
    </div>
  );
}
