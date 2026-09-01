"use client";

import { useState } from "react";
import { apiPost, ApiError } from "@/lib/api";
import { MaterialUnit, UNIT_LABELS } from "@/lib/types";
import BottomSheet from "@/components/BottomSheet";
import { ErrorAlert, Field, fieldClass } from "@/components/ui/form-field";

/** نافذة إضافة صنف جديد للمخزون يدويًا. */
export default function AddMaterialSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<MaterialUnit>("KG");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [vat, setVat] = useState("15");
  const [reorder, setReorder] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAdd() {
    const priceNum = Number(price);
    if (!name.trim()) {
      setFormError("أدخل اسم الصنف");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setFormError("أدخل سعر شراء صحيحًا");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const qtyNum = Number(qty) || 0;
      await apiPost("/materials", {
        name: name.trim(),
        unit,
        // ما دفعته فعليًا مقابل الكمية المشتراة (شامل الضريبة إن وجدت)
        purchasePrice: priceNum,
        purchaseQty: qtyNum > 0 ? qtyNum : 1,
        vatRate: Number(vat) || 0,
        initialQty: qtyNum,
        reorderLevel: reorder === "" ? undefined : Number(reorder),
      });
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذر إضافة الصنف");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="صنف جديد" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="اسم الصنف" htmlFor="add-name">
          <input
            id="add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: طحين"
            className={fieldClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الوحدة" htmlFor="add-unit">
            <select
              id="add-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as MaterialUnit)}
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
          </Field>
          <Field label="الكمية المشتراة" htmlFor="add-qty">
            <input
              id="add-qty"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="مثال: 10"
              className={fieldClass}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="سعر الشراء الإجمالي (ر.س)" htmlFor="add-price">
            <input
              id="add-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="ما دفعته للكمية كاملة"
              className={fieldClass}
            />
          </Field>
          <Field label="ضريبة القيمة المضافة" htmlFor="add-vat">
            <select
              id="add-vat"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              className={fieldClass}
            >
              <option value="15">شامل ضريبة 15%</option>
              <option value="0">بدون ضريبة</option>
            </select>
          </Field>
        </div>
        <Field label="حد إعادة الطلب" htmlFor="add-reorder" hint="(اختياري)">
          <input
            id="add-reorder"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={reorder}
            onChange={(e) => setReorder(e.target.value)}
            placeholder="ينبهك عند الوصول له"
            className={fieldClass}
          />
        </Field>
        {Number(qty) > 0 && Number(price) > 0 && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
            سعر الوحدة: {(Number(price) / Number(qty)).toFixed(2)} ر.س
            {Number(vat) > 0 &&
              ` — منها ضريبة ${(
                (Number(price) * Number(vat)) /
                (100 + Number(vat))
              ).toFixed(2)} ر.س`}
          </p>
        )}
        <ErrorAlert>{formError}</ErrorAlert>
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving}
          className="motion-press w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white active:bg-brand-800 disabled:opacity-60"
        >
          {saving ? "جاري الحفظ..." : "إضافة للمخزون"}
        </button>
      </div>
    </BottomSheet>
  );
}
