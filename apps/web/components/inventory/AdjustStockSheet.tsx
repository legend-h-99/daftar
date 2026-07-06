"use client";

import { useState } from "react";
import { apiPatch, apiPost, ApiError } from "@/lib/api";
import { roundQty } from "@/lib/format";
import { InventoryMaterial, UNIT_LABELS } from "@/lib/types";
import BottomSheet from "@/components/BottomSheet";
import { ErrorAlert, Field, fieldClass } from "@/components/ui/form-field";

/** نافذة تعديل كمية/سعر/حد إعادة طلب صنف موجود في المخزون. */
export default function AdjustStockSheet({
  material,
  onClose,
  onSaved,
}: {
  material: InventoryMaterial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newQty, setNewQty] = useState(String(material.stockQty));
  const [newReorder, setNewReorder] = useState(
    material.reorderLevel != null ? String(material.reorderLevel) : "",
  );
  const [newPurchasePrice, setNewPurchasePrice] = useState(
    String(material.purchasePrice),
  );
  const [newVat, setNewVat] = useState(String(material.vatRate ?? 0));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAdjust() {
    const qty = Number(newQty);
    if (Number.isNaN(qty) || qty < 0) {
      setFormError("أدخل كمية صحيحة");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (qty !== material.stockQty) {
        await apiPost("/inventory/adjust", {
          materialId: material.id,
          newQty: qty,
          note: note.trim() || undefined,
        });
      }
      const reorder = newReorder === "" ? null : Number(newReorder);
      const price = Number(newPurchasePrice);
      const vat = Number(newVat);
      const patch: Record<string, number> = {};
      if (reorder !== null && reorder !== (material.reorderLevel ?? null)) {
        patch.reorderLevel = reorder;
      }
      if (!Number.isNaN(price) && price >= 0 && price !== material.purchasePrice) {
        patch.purchasePrice = price;
      }
      if (!Number.isNaN(vat) && vat !== material.vatRate) {
        patch.vatRate = vat;
      }
      if (Object.keys(patch).length > 0) {
        await apiPatch(`/materials/${material.id}`, patch);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذر تعديل الكمية");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title={`تعديل كمية: ${material.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field
          label={`الكمية الفعلية بعد الجرد (${UNIT_LABELS[material.unit]})`}
          htmlFor="adj-qty"
        >
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
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="سعر الشراء (ر.س)" htmlFor="adj-price">
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
              لكل {roundQty(material.purchaseQty, 2)} {UNIT_LABELS[material.unit]}
            </p>
          </Field>
          <Field label="ضريبة القيمة المضافة" htmlFor="adj-vat">
            <select
              id="adj-vat"
              value={newVat}
              onChange={(e) => setNewVat(e.target.value)}
              className={fieldClass}
            >
              <option value="15">شامل ضريبة 15%</option>
              <option value="0">بدون ضريبة</option>
            </select>
          </Field>
        </div>
        <Field
          label="حد إعادة الطلب"
          htmlFor="adj-reorder"
          hint="(ينبهك عند الوصول له)"
        >
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
        </Field>
        <Field label="السبب" htmlFor="adj-note" hint="(اختياري)">
          <input
            id="adj-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: جرد نهاية الأسبوع"
            className={fieldClass}
          />
        </Field>
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
  );
}
