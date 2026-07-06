"use client";

import { useState } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { InvoiceItem, Product } from "@/lib/types";
import { formatSAR } from "@/lib/format";

/** محرّر أصناف الفاتورة: منتقي منتج + صفوف قابلة للتعديل (سعر/كمية/حذف). */
export default function InvoiceItemsEditor({
  items,
  products,
  onAdd,
  onUpdate,
  onRemove,
}: {
  items: InvoiceItem[];
  products: Product[];
  onAdd: (product: Product) => void;
  onUpdate: (index: number, patch: Partial<InvoiceItem>) => void;
  onRemove: (index: number) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">الأصناف</h3>
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700"
        >
          <Search className="h-3.5 w-3.5" />
          اختر منتج
        </button>
      </div>

      {showPicker && (
        <ul className="mb-3 flex max-h-48 flex-col divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-100">
          {products.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-gray-500">
              لا يوجد منتجات مضافة بعد
            </li>
          )}
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(p);
                  setShowPicker(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-right text-sm active:bg-gray-50"
              >
                <span className="text-gray-800">{p.name}</span>
                <span className="text-gray-500">{formatSAR(p.sellingPrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-500">لم تضف أي صنف بعد</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-100 bg-gray-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <input
                  value={item.name}
                  onChange={(e) => onUpdate(index, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label="حذف"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 active:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <label className="text-[11px] font-medium text-gray-500">
                    سعر الوحدة
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      onUpdate(index, {
                        unitPrice: Number(e.target.value) || 0,
                      })
                    }
                    className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate(index, {
                        quantity: Math.max(1, item.quantity - 1),
                      })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-700 active:bg-gray-300"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-gray-900">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdate(index, { quantity: item.quantity + 1 })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-700 active:bg-gray-300"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2 text-left text-xs font-semibold text-gray-500">
                الإجمالي: {formatSAR(item.unitPrice * item.quantity)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
