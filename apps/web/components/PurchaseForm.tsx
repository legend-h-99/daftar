"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { formatSAR } from "@/lib/format";
import {
  Material,
  MaterialUnit,
  OcrDraft,
  PurchaseSource,
  UNIT_LABELS,
} from "@/lib/types";

const NEW_MATERIAL = "__new__";

interface RowState {
  materialId?: string;
  name: string;
  unit: MaterialUnit;
  quantity: string;
  unitPrice: string;
  confidence?: number;
}

function emptyRow(): RowState {
  return { name: "", unit: "KG", quantity: "", unitPrice: "" };
}

function confidenceBadge(confidence?: number) {
  if (confidence === undefined) return null;
  const pct = Math.round(confidence * 100);
  const tone =
    confidence >= 0.85
      ? "bg-green-50 text-green-700"
      : confidence >= 0.7
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
      دقة القراءة {pct}%
    </span>
  );
}

/**
 * Shared purchase entry form. Used empty for manual entry, or pre-filled
 * from an OCR draft (review-and-confirm: nothing is saved until the user
 * checks every line and presses save).
 */
export default function PurchaseForm({
  draft,
  source,
}: {
  draft?: OcrDraft;
  source: PurchaseSource;
}) {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [supplierName, setSupplierName] = useState(draft?.supplierName ?? "");
  const [date, setDate] = useState(
    draft?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [rows, setRows] = useState<RowState[]>(
    draft && draft.items.length > 0
      ? draft.items.map((i) => ({
          materialId: i.materialId,
          name: i.name,
          unit: i.unit,
          quantity: String(i.quantity),
          unitPrice: String(i.unitPrice),
          confidence: i.confidence,
        }))
      : [emptyRow()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Material[]>("/materials").then(setMaterials).catch(() => {});
  }, []);

  const total = useMemo(
    () =>
      rows.reduce(
        (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
        0,
      ),
    [rows],
  );

  function updateRow(index: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function selectMaterial(index: number, value: string) {
    if (value === NEW_MATERIAL) {
      updateRow(index, { materialId: undefined, name: "" });
      return;
    }
    const material = materials.find((m) => m.id === value);
    if (material) {
      updateRow(index, {
        materialId: material.id,
        name: material.name,
        unit: material.unit,
        unitPrice: material.unitPrice ? String(material.unitPrice) : "",
      });
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const items = rows
      .filter((r) => r.name.trim() && Number(r.quantity) > 0)
      .map((r) => ({
        materialId: r.materialId,
        name: r.name.trim(),
        unit: r.unit,
        quantity: Number(r.quantity),
        unitPrice: Number(r.unitPrice) || 0,
      }));
    if (items.length === 0) {
      setError("أضف صنف واحد على الأقل بكمية صحيحة");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost("/purchases", {
        supplierName: supplierName.trim() || undefined,
        date,
        source,
        items,
      });
      router.push("/purchases");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر حفظ فاتورة الشراء");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            المورد <span className="font-normal text-gray-500">(اختياري)</span>
          </label>
          <input
            aria-label="اسم المورد"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="اسم المورد"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            التاريخ
          </label>
          <input
            aria-label="تاريخ فاتورة الشراء"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="flex flex-col gap-2.5 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <select
                aria-label="اختر الصنف"
                value={row.materialId ?? NEW_MATERIAL}
                onChange={(e) => selectMaterial(index, e.target.value)}
                className={inputClass}
              >
                <option value={NEW_MATERIAL}>صنف جديد (يُضاف للمخزون)</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {UNIT_LABELS[m.unit]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setRows((prev) =>
                    prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
                  )
                }
                aria-label="حذف السطر"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 active:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {!row.materialId && (
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  aria-label="اسم الصنف"
                  value={row.name}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                  placeholder="اسم الصنف"
                  className={inputClass}
                />
                <select
                  aria-label="الوحدة"
                  value={row.unit}
                  onChange={(e) =>
                    updateRow(index, { unit: e.target.value as MaterialUnit })
                  }
                  className={inputClass}
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
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs text-gray-500">الكمية</label>
                <input
                  aria-label="الكمية"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateRow(index, { quantity: e.target.value })}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  سعر الوحدة (ر.س)
                </label>
                <input
                  aria-label="سعر الوحدة"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={row.unitPrice}
                  onChange={(e) => updateRow(index, { unitPrice: e.target.value })}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              {confidenceBadge(row.confidence) ?? <span />}
              <span className="text-xs font-bold text-gray-600">
                الإجمالي:{" "}
                {formatSAR((Number(row.quantity) || 0) * (Number(row.unitPrice) || 0))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
        className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-300 py-3 text-sm font-semibold text-gray-500 active:bg-gray-50"
      >
        <Plus className="h-4 w-4" />
        إضافة صنف
      </button>

      <div className="flex items-center justify-between rounded-2xl bg-brand-900 px-4 py-3.5 text-white">
        <span className="text-sm text-brand-100">إجمالي فاتورة الشراء</span>
        <span className="text-lg font-extrabold">{formatSAR(total)}</span>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white active:bg-brand-800 disabled:opacity-60"
      >
        {saving ? "جاري الحفظ..." : "حفظ وتحديث المخزون"}
      </button>
    </form>
  );
}
