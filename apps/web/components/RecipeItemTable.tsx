"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Material,
  MaterialUnit,
  RecipeItem,
  RecipeItemType,
  UNIT_LABELS,
} from "@/lib/types";
import { formatSAR } from "@/lib/format";
import { lineCost } from "@/lib/calc";

const UNIT_OPTIONS: MaterialUnit[] = ["KG", "GRAM", "LITER", "ML", "PIECE"];
const FREE_ENTRY = "__free__";

interface RecipeItemTableProps {
  title: string;
  type: RecipeItemType;
  items: RecipeItem[];
  onChange: (items: RecipeItem[]) => void;
  /** Inventory materials — each recipe row pulls name/unit/price from here. */
  materials?: Material[];
}

function emptyItem(type: RecipeItemType): RecipeItem {
  return { name: "", unit: "PIECE", unitPrice: 0, quantityUsed: 0, type };
}

export default function RecipeItemTable({
  title,
  type,
  items,
  onChange,
  materials = [],
}: RecipeItemTableProps) {
  function updateItem(index: number, patch: Partial<RecipeItem>) {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    onChange(next);
  }

  /** Selecting an inventory item pulls its name/unit/unit-cost into the row. */
  function selectMaterial(index: number, value: string) {
    if (value === FREE_ENTRY) {
      updateItem(index, { materialId: undefined });
      return;
    }
    const material = materials.find((m) => m.id === value);
    if (material) {
      updateItem(index, {
        materialId: material.id,
        name: material.name,
        unit: material.unit,
        unitPrice: material.unitPrice,
      });
    }
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, emptyItem(type)]);
  }

  const subtotal = items.reduce((sum, item) => sum + lineCost(item), 0);

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <span className="text-xs font-semibold text-gray-500">
          {formatSAR(subtotal)}
        </span>
      </div>

      {items.length === 0 && (
        <p className="mb-3 text-xs text-gray-500">لا توجد عناصر بعد</p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-100 bg-gray-50 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              {materials.length > 0 ? (
                <select
                  aria-label="اختر المادة من المخزون"
                  value={item.materialId ?? FREE_ENTRY}
                  onChange={(e) => selectMaterial(index, e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500"
                >
                  <option value={FREE_ENTRY}>✏️ إدخال حر (بدون ربط بالمخزون)</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {UNIT_LABELS[m.unit]} ({formatSAR(m.unitPrice)})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label="اسم المادة"
                  value={item.name}
                  onChange={(e) => updateItem(index, { name: e.target.value })}
                  placeholder="اسم المادة"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500"
                />
              )}
              <button
                type="button"
                onClick={() => removeItem(index)}
                aria-label="حذف"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 active:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {!item.materialId && materials.length > 0 && (
              <input
                aria-label="اسم المادة"
                value={item.name}
                onChange={(e) => updateItem(index, { name: e.target.value })}
                placeholder="اسم المادة"
                className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500"
              />
            )}

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-medium text-gray-500">
                  الوحدة
                </label>
                {item.materialId ? (
                  <div className="w-full rounded-lg border border-gray-100 bg-gray-100 px-2 py-2 text-sm text-gray-600">
                    {UNIT_LABELS[item.unit]}
                  </div>
                ) : (
                  <select
                    aria-label="الوحدة"
                    value={item.unit}
                    onChange={(e) =>
                      updateItem(index, { unit: e.target.value as MaterialUnit })
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-brand-500"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-medium text-gray-500">
                  السعر
                </label>
                {item.materialId ? (
                  <div
                    className="w-full rounded-lg border border-gray-100 bg-gray-100 px-2 py-2 text-sm text-gray-600"
                    title="السعر مسحوب من المخزون ويتحدث تلقائيًا"
                  >
                    {item.unitPrice}
                  </div>
                ) : (
                  <input
                    aria-label="السعر"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      updateItem(index, { unitPrice: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-brand-500"
                  />
                )}
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-medium text-gray-500">
                  الكمية المستخدمة
                </label>
                <input
                  aria-label="الكمية المستخدمة"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={item.quantityUsed || ""}
                  onChange={(e) =>
                    updateItem(index, {
                      quantityUsed: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-gray-500">
              {item.materialId ? (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                  📦 من المخزون
                </span>
              ) : (
                <span />
              )}
              <span>التكلفة: {formatSAR(lineCost(item))}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 py-2.5 text-sm font-semibold text-brand-700 active:bg-brand-50"
      >
        <Plus className="h-4 w-4" />
        إضافة
      </button>
    </div>
  );
}
