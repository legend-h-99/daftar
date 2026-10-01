"use client";

import { Trash2 } from "lucide-react";
import { formatSAR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";
import { Material, MaterialUnit, UNIT_LABELS, UNIT_LABELS_EN } from "@/lib/types";
import { useLanguage } from "@/lib/language";

/** القيمة المميِّزة لخيار «صنف جديد» في قائمة اختيار الصنف. */
export const NEW_MATERIAL = "__new__";

/** الستايل المضغوط لحقول نموذج الشراء (أصغر من الحقل القياسي). */
export const purchaseInputClass = cn(fieldClass, "px-3 py-2.5 text-sm");

export interface RowState {
  materialId?: string;
  name: string;
  unit: MaterialUnit;
  quantity: string;
  unitPrice: string;
  confidence?: number;
}

export function emptyRow(): RowState {
  return { name: "", unit: "KG", quantity: "", unitPrice: "" };
}

function confidenceBadge(confidence: number | undefined, en: boolean) {
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
      {en ? `${pct}% confidence` : `دقة القراءة ${pct}%`}
    </span>
  );
}

/** سطر صنف واحد داخل نموذج الشراء: اختيار الصنف/الكمية/السعر + إجمالي السطر. */
export default function PurchaseRow({
  row,
  materials,
  onSelect,
  onChange,
  onRemove,
}: {
  row: RowState;
  materials: Material[];
  onSelect: (value: string) => void;
  onChange: (patch: Partial<RowState>) => void;
  onRemove: () => void;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const unitLabels = en ? UNIT_LABELS_EN : UNIT_LABELS;
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <select
          aria-label={en ? "Choose an item" : "اختر الصنف"}
          value={row.materialId ?? NEW_MATERIAL}
          onChange={(e) => onSelect(e.target.value)}
          className={purchaseInputClass}
        >
          <option value={NEW_MATERIAL}>{en ? "New item (added to stock)" : "صنف جديد (يُضاف للمخزون)"}</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {unitLabels[m.unit]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label={en ? "Remove row" : "حذف السطر"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 active:bg-red-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {!row.materialId && (
        <div className="grid grid-cols-2 gap-2.5">
          <input
            aria-label={en ? "Item name" : "اسم الصنف"}
            value={row.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={en ? "Item name" : "اسم الصنف"}
            className={purchaseInputClass}
          />
          <select
            aria-label={en ? "Unit" : "الوحدة"}
            value={row.unit}
            onChange={(e) => onChange({ unit: e.target.value as MaterialUnit })}
            className={purchaseInputClass}
          >
            {(Object.entries(unitLabels) as [MaterialUnit, string][]).map(
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
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Quantity" : "الكمية"}</label>
          <input
            aria-label={en ? "Quantity" : "الكمية"}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={row.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            placeholder="0"
            className={purchaseInputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {en ? "Unit price (SAR)" : "سعر الوحدة (ر.س)"}
          </label>
          <input
            aria-label={en ? "Unit price" : "سعر الوحدة"}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={row.unitPrice}
            onChange={(e) => onChange({ unitPrice: e.target.value })}
            placeholder="0.00"
            className={purchaseInputClass}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {confidenceBadge(row.confidence, en) ?? <span />}
        <span className="text-xs font-bold text-muted-foreground">
          {en ? "Total:" : "الإجمالي:"}{" "}
          {formatSAR((Number(row.quantity) || 0) * (Number(row.unitPrice) || 0), language)}
        </span>
      </div>
    </div>
  );
}
