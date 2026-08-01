"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { formatSAR } from "@/lib/format";
import { Material, OcrDraft, PurchaseSource } from "@/lib/types";
import PurchaseRow, {
  emptyRow,
  NEW_MATERIAL,
  purchaseInputClass,
  RowState,
} from "@/components/purchases/PurchaseRow";

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

  function removeRow(index: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
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
      router.push("/inventory?purchaseUpdated=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر حفظ فاتورة الشراء");
      setSaving(false);
    }
  }

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
            className={purchaseInputClass}
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
            className={purchaseInputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <PurchaseRow
            key={index}
            row={row}
            materials={materials}
            onSelect={(value) => selectMaterial(index, value)}
            onChange={(patch) => updateRow(index, patch)}
            onRemove={() => removeRow(index)}
          />
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
