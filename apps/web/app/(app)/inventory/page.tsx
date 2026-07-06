"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Camera,
  ClipboardList,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { formatDate, formatSAR, roundQty } from "@/lib/format";
import {
  InventoryMaterial,
  MaterialUnit,
  MOVEMENT_TYPE_LABELS,
  StockMovement,
  UNIT_LABELS,
} from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import BottomSheet from "@/components/BottomSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert, fieldClass } from "@/components/ui/form-field";

type Tab = "items" | "movements";

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<InventoryMaterial[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [adjusting, setAdjusting] = useState<InventoryMaterial | null>(null);
  const [newQty, setNewQty] = useState("");
  const [newReorder, setNewReorder] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newPurchasePrice, setNewPurchasePrice] = useState("");
  const [newVat, setNewVat] = useState("0");

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addUnit, setAddUnit] = useState<MaterialUnit>("KG");
  const [addQty, setAddQty] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addVat, setAddVat] = useState("15");
  const [addReorder, setAddReorder] = useState("");

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

  async function handleAdjust() {
    if (!adjusting) return;
    const qty = Number(newQty);
    if (Number.isNaN(qty) || qty < 0) {
      setFormError("أدخل كمية صحيحة");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (qty !== adjusting.stockQty) {
        await apiPost("/inventory/adjust", {
          materialId: adjusting.id,
          newQty: qty,
          note: note.trim() || undefined,
        });
      }
      const reorder = newReorder === "" ? null : Number(newReorder);
      const price = Number(newPurchasePrice);
      const vat = Number(newVat);
      const patch: Record<string, number> = {};
      if (reorder !== null && reorder !== (adjusting.reorderLevel ?? null)) {
        patch.reorderLevel = reorder;
      }
      if (!Number.isNaN(price) && price >= 0 && price !== adjusting.purchasePrice) {
        patch.purchasePrice = price;
      }
      if (!Number.isNaN(vat) && vat !== adjusting.vatRate) {
        patch.vatRate = vat;
      }
      if (Object.keys(patch).length > 0) {
        await apiPatch(`/materials/${adjusting.id}`, patch);
      }
      setAdjusting(null);
      setNewQty("");
      setNewReorder("");
      setNote("");
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذر تعديل الكمية");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const price = Number(addPrice);
    if (!addName.trim()) {
      setFormError("أدخل اسم الصنف");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setFormError("أدخل سعر شراء صحيحًا");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const qty = Number(addQty) || 0;
      await apiPost("/materials", {
        name: addName.trim(),
        unit: addUnit,
        // ما دفعته فعليًا مقابل الكمية المشتراة (شامل الضريبة إن وجدت)
        purchasePrice: price,
        purchaseQty: qty > 0 ? qty : 1,
        vatRate: Number(addVat) || 0,
        initialQty: qty,
        reorderLevel: addReorder === "" ? undefined : Number(addReorder),
      });
      setShowAdd(false);
      setAddName("");
      setAddQty("");
      setAddPrice("");
      setAddReorder("");
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذر إضافة الصنف");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(material: InventoryMaterial) {
    if (!confirm(`متأكد إنك تبي تحذف "${material.name}" من المخزون؟`)) return;
    try {
      await apiDelete(`/materials/${material.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر حذف الصنف");
    }
  }

  const lowCount = (items ?? []).filter((m) => m.lowStock).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">المخزون</h1>
        <div className="flex gap-2">
          <Link
            href="/purchases/scan"
            className="flex h-10 items-center gap-1.5 rounded-full bg-brand-700 px-3.5 text-sm font-bold text-white shadow-sm active:bg-brand-800"
          >
            <Camera className="h-4 w-4" />
            تصوير فاتورة
          </Link>
          <Link
            href="/purchases"
            aria-label="المشتريات"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm active:bg-gray-50"
          >
            <ShoppingCart className="h-5 w-5" />
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
            onClick={() => {
              setShowAdd(true);
              setFormError(null);
            }}
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
                      onClick={() => {
                        setAdjusting(m);
                        setNewQty(String(m.stockQty));
                        setNewReorder(
                          m.reorderLevel != null ? String(m.reorderLevel) : "",
                        );
                        setNewPurchasePrice(String(m.purchasePrice));
                        setNewVat(String(m.vatRate ?? 0));
                        setFormError(null);
                      }}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 active:bg-gray-50"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m)}
                      aria-label={`حذف ${m.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 active:bg-red-100"
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
        <BottomSheet
          title={`تعديل كمية: ${adjusting.name}`}
          onClose={() => setAdjusting(null)}
        >
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="adj-qty"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                الكمية الفعلية بعد الجرد ({UNIT_LABELS[adjusting.unit]})
              </label>
              <input
                id="adj-qty"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="adj-price"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  سعر الشراء (ر.س)
                </label>
                <input
                  id="adj-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={newPurchasePrice}
                  onChange={(e) => setNewPurchasePrice(e.target.value)}
                  className={fieldClass}
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  لكل {roundQty(adjusting.purchaseQty, 2)}{" "}
                  {UNIT_LABELS[adjusting.unit]}
                </p>
              </div>
              <div>
                <label
                  htmlFor="adj-vat"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  ضريبة القيمة المضافة
                </label>
                <select
                  id="adj-vat"
                  value={newVat}
                  onChange={(e) => setNewVat(e.target.value)}
                  className={fieldClass}
                >
                  <option value="15">شامل ضريبة 15%</option>
                  <option value="0">بدون ضريبة</option>
                </select>
              </div>
            </div>
            <div>
              <label
                htmlFor="adj-reorder"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                حد إعادة الطلب{" "}
                <span className="font-normal text-gray-500">
                  (ينبهك عند الوصول له)
                </span>
              </label>
              <input
                id="adj-reorder"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={newReorder}
                onChange={(e) => setNewReorder(e.target.value)}
                placeholder="مثال: 5"
                className={fieldClass}
              />
            </div>
            <div>
              <label
                htmlFor="adj-note"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                السبب <span className="font-normal text-gray-500">(اختياري)</span>
              </label>
              <input
                id="adj-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثال: جرد نهاية الأسبوع"
                className={fieldClass}
              />
            </div>
            <ErrorAlert>{formError}</ErrorAlert>
            <button
              type="button"
              onClick={handleAdjust}
              disabled={saving}
              className="w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white active:bg-brand-800 disabled:opacity-60"
            >
              {saving ? "جاري الحفظ..." : "حفظ التعديل"}
            </button>
          </div>
        </BottomSheet>
      )}

      {showAdd && (
        <BottomSheet title="صنف جديد" onClose={() => setShowAdd(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="add-name"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                اسم الصنف
              </label>
              <input
                id="add-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="مثال: طحين"
                className={fieldClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="add-unit"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  الوحدة
                </label>
                <select
                  id="add-unit"
                  value={addUnit}
                  onChange={(e) => setAddUnit(e.target.value as MaterialUnit)}
                  className={fieldClass}
                >
                  {(Object.entries(UNIT_LABELS) as [MaterialUnit, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label
                  htmlFor="add-qty"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  الكمية المشتراة
                </label>
                <input
                  id="add-qty"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  placeholder="مثال: 10"
                  className={fieldClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="add-price"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  سعر الشراء الإجمالي (ر.س)
                </label>
                <input
                  id="add-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  placeholder="ما دفعته للكمية كاملة"
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="add-vat"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  ضريبة القيمة المضافة
                </label>
                <select
                  id="add-vat"
                  value={addVat}
                  onChange={(e) => setAddVat(e.target.value)}
                  className={fieldClass}
                >
                  <option value="15">شامل ضريبة 15%</option>
                  <option value="0">بدون ضريبة</option>
                </select>
              </div>
            </div>
            <div>
              <label
                htmlFor="add-reorder"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                حد إعادة الطلب{" "}
                <span className="font-normal text-gray-500">(اختياري)</span>
              </label>
              <input
                id="add-reorder"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={addReorder}
                onChange={(e) => setAddReorder(e.target.value)}
                placeholder="ينبهك عند الوصول له"
                className={fieldClass}
              />
            </div>
            {Number(addQty) > 0 && Number(addPrice) > 0 && (
              <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                سعر الوحدة: {(Number(addPrice) / Number(addQty)).toFixed(2)} ر.س
                {Number(addVat) > 0 &&
                  ` — منها ضريبة ${(
                    (Number(addPrice) * Number(addVat)) /
                    (100 + Number(addVat))
                  ).toFixed(2)} ر.س`}
              </p>
            )}
            <ErrorAlert>{formError}</ErrorAlert>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white active:bg-brand-800 disabled:opacity-60"
            >
              {saving ? "جاري الحفظ..." : "إضافة للمخزون"}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
