"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Camera,
  ClipboardList,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import { formatDate, formatSAR, roundQty } from "@/lib/format";
import {
  InventoryMaterial,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_LABELS_EN,
  StockMovement,
  UNIT_LABELS,
  UNIT_LABELS_EN,
} from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ui/form-field";
import AdjustStockSheet from "@/components/inventory/AdjustStockSheet";
import AddMaterialSheet from "@/components/inventory/AddMaterialSheet";
import { useLanguage } from "@/lib/language";

type Tab = "items" | "movements";

export default function InventoryPage() {
  const { language } = useLanguage();
  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<InventoryMaterial[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchaseUpdated, setPurchaseUpdated] = useState(false);

  const [adjusting, setAdjusting] = useState<InventoryMaterial | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    apiGet<InventoryMaterial[]>("/inventory")
      .then(setItems)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : language === "ar" ? "تعذر تحميل المخزون" : "Could not load stock"),
      );
    apiGet<StockMovement[]>("/inventory/movements")
      .then(setMovements)
      .catch(() => {});
  }

  useEffect(() => {
    load();
    setPurchaseUpdated(new URLSearchParams(window.location.search).get("purchaseUpdated") === "1");
  }, []);

  function handleDelete(material: InventoryMaterial) {
    if (deletingId !== material.id) {
      setDeletingId(material.id);
      return;
    }
    setDeletingId(null);
    apiDelete(`/materials/${material.id}`)
      .then(load)
      .catch((err) => setError(err instanceof ApiError ? err.message : language === "ar" ? "تعذر حذف الصنف" : "Could not delete item"));
  }

  const lowCount = (items ?? []).filter((m) => m.lowStock).length;
  const units = language === "ar" ? UNIT_LABELS : UNIT_LABELS_EN;
  const movementLabels = language === "ar" ? MOVEMENT_TYPE_LABELS : MOVEMENT_TYPE_LABELS_EN;

  return (
    <div className="flex flex-col gap-4" onClick={() => setDeletingId(null)}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">
          {language === "ar" ? "المخزون" : "Stock"}
        </h1>
        <div className="flex gap-2">
          <Link
            href="/products"
            aria-label={language === "ar" ? "المنتجات" : "Products"}
            className="flex h-10 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-sm font-bold text-brand-700 shadow-sm active:bg-brand-100"
          >
            <Package className="h-4 w-4" />
            {language === "ar" ? "المنتجات" : "Products"}
          </Link>
          <Link
            href="/purchases/scan"
            className="flex h-10 items-center gap-1.5 rounded-full bg-brand-700 px-3.5 text-sm font-bold text-white shadow-sm active:bg-brand-800"
          >
            <Camera className="h-4 w-4" />
            {language === "ar" ? "تصوير" : "Scan"}
          </Link>
        </div>
      </div>

      {lowCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={2.25} aria-hidden="true" />
          <span className="text-sm font-semibold text-amber-800">
            {language === "ar"
              ? `${lowCount} صنف وصل حد إعادة الطلب — راجع الكميات وأنشئ فاتورة شراء`
              : `${lowCount} items reached reorder level. Review quantities and record a purchase.`}
          </span>
        </div>
      )}

      {purchaseUpdated && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-green-50 px-4 py-3">
          <ArrowDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-green-700" strokeWidth={2.25} aria-hidden="true" />
          <span className="text-sm font-semibold text-green-800">
            {language === "ar" ? "تم حفظ فاتورة الشراء وتحديث كميات المخزون مباشرة" : "Purchase saved and stock quantities updated."}
          </span>
        </div>
      )}

      <div className="flex rounded-2xl bg-gray-100 p-1">
        {(
          [
            ["items", language === "ar" ? "الأصناف" : "Items"],
            ["movements", language === "ar" ? "سجل الحركات" : "Movements"],
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
            {language === "ar" ? "إضافة صنف يدويًا" : "Add item manually"}
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
              title={language === "ar" ? "ما عندك أصناف في المخزون" : "No stock items yet"}
              description={language === "ar" ? "أضف أصنافك بتصوير فاتورة شراء أو بتسجيل شراء يدوي" : "Add items by scanning a purchase invoice or recording one manually."}
              actionLabel={language === "ar" ? "تسجيل شراء" : "Record purchase"}
              actionHref="/purchases/new"
            />
          )}

          {items && items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {items.map((m) => (
                <li
                  key={m.id}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{m.name}</span>
                      {m.lowStock && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          {language === "ar" ? "منخفض" : "Low"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {language === "ar" ? "سعر الوحدة" : "Unit cost"} {formatSAR(m.unitPrice, language)}
                      {m.reorderLevel != null &&
                        (language === "ar" ? ` · حد إعادة الطلب ${m.reorderLevel}` : ` · reorder ${m.reorderLevel}`)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {language === "ar" ? "سعر الشراء" : "Purchase price"} {formatSAR(m.purchasePrice, language)} {language === "ar" ? "لكل" : "per"}{" "}
                      {roundQty(m.purchaseQty, 2)} {units[m.unit]}
                      {m.vatRate > 0
                        ? language === "ar" ? ` · شامل ضريبة ${m.vatRate}% (${formatSAR(
                            (m.purchasePrice * m.vatRate) / (100 + m.vatRate),
                            language,
                          )})` : ` · includes ${m.vatRate}% VAT (${formatSAR(
                            (m.purchasePrice * m.vatRate) / (100 + m.vatRate),
                            language,
                          )})`
                        : language === "ar" ? " · بدون ضريبة" : " · no VAT"}
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
                        {units[m.unit]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdjusting(m)}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 active:bg-gray-50"
                    >
                      {language === "ar" ? "تعديل" : "Adjust"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m)}
                      aria-label={deletingId === m.id ? (language === "ar" ? `تأكيد حذف ${m.name}` : `Confirm deleting ${m.name}`) : (language === "ar" ? `حذف ${m.name}` : `Delete ${m.name}`)}
                      title={deletingId === m.id ? (language === "ar" ? "اضغط مرة ثانية للتأكيد" : "Tap again to confirm") : ""}
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
              title={language === "ar" ? "لا توجد حركات بعد" : "No movements yet"}
              description={language === "ar" ? "كل شراء أو بيع أو تعديل يدوي ينسجل هنا تلقائيًا" : "Purchases, sales, and manual adjustments will appear here automatically."}
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
                            · {movementLabels[mv.type]}
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
                        {language === "ar" ? "الرصيد" : "Balance"} {roundQty(mv.balanceAfter)}{" "}
                        {units[mv.material.unit]}
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
