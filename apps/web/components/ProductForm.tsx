"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import RecipeItemTable from "@/components/RecipeItemTable";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { calculateCosts } from "@/lib/calc";
import { formatSAR } from "@/lib/format";
import { Material, Product, RecipeItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";

interface ProductFormProps {
  product?: Product;
}

export default function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const isEdit = !!product;

  const [name, setName] = useState(product?.name || "");
  const [rawItems, setRawItems] = useState<RecipeItem[]>(
    product?.recipeItems.filter((i) => i.type === "RAW") || [],
  );
  const [packagingItems, setPackagingItems] = useState<RecipeItem[]>(
    product?.recipeItems.filter((i) => i.type === "PACKAGING") || [],
  );
  const [overheadCost, setOverheadCost] = useState<number>(
    product?.overheadCost || 0,
  );
  const [profitMargin, setProfitMargin] = useState<number>(
    product?.profitMargin ?? 30,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingConfirm, setDeletingConfirm] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);

  // Inventory catalog: recipe rows pull name/unit/cost from here so the
  // product stays linked to stock (and sales can consume it automatically).
  useEffect(() => {
    apiGet<Material[]>("/materials").then(setMaterials).catch((err) => {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل المواد الخام");
    });
  }, []);

  const allItems = useMemo(
    () => [...rawItems, ...packagingItems],
    [rawItems, packagingItems],
  );

  const result = useMemo(
    () => calculateCosts(allItems, overheadCost, profitMargin),
    [allItems, overheadCost, profitMargin],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("اكتب اسم المنتج");
      return;
    }
    setError(null);
    setSaving(true);
    const payload = {
      name: name.trim(),
      profitMargin,
      overheadCost: overheadCost || undefined,
      recipeItems: allItems.map((item) => ({
        materialId: item.materialId || undefined,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantityUsed: item.quantityUsed,
        type: item.type,
      })),
    };
    try {
      if (isEdit && product) {
        await apiPatch(`/products/${product.id}`, payload);
      } else {
        await apiPost("/products", payload);
      }
      router.push("/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر حفظ المنتج");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    if (!deletingConfirm) {
      setDeletingConfirm(true);
      return;
    }
    setDeletingConfirm(false);
    setDeleting(true);
    try {
      await apiDelete(`/products/${product.id}`);
      router.push("/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر حذف المنتج");
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="product-name" className="mb-1.5 block text-sm font-semibold text-gray-700">
          اسم المنتج
        </label>
        <input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: كيك شوكولاتة"
          className={cn(fieldClass, "py-3.5")}
        />
      </div>

      <RecipeItemTable
        title="المواد الخام"
        type="RAW"
        items={rawItems}
        onChange={setRawItems}
        materials={materials}
      />

      <RecipeItemTable
        title="التغليف"
        type="PACKAGING"
        items={packagingItems}
        onChange={setPackagingItems}
        materials={materials}
      />

      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <label htmlFor="product-overhead" className="mb-1.5 block text-sm font-semibold text-gray-700">
          تكاليف تشغيل إضافية{" "}
          <span className="font-normal text-gray-500">(اختياري)</span>
        </label>
        <input
          id="product-overhead"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={overheadCost || ""}
          onChange={(e) => setOverheadCost(Number(e.target.value) || 0)}
          placeholder="0.00"
          className={fieldClass}
        />
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700">
            نسبة الربح %
          </label>
          <span className="text-sm font-bold text-brand-700">
            {profitMargin}%
          </span>
        </div>
        <input
          aria-label="نسبة الربح بالنسبة المئوية"
          type="range"
          min={0}
          max={90}
          step={1}
          value={profitMargin}
          onChange={(e) => setProfitMargin(Number(e.target.value))}
          className="w-full accent-brand-600"
        />
        <input
          aria-label="نسبة الربح بالنسبة المئوية"
          type="number"
          inputMode="decimal"
          min={0}
          max={99}
          value={profitMargin}
          onChange={(e) => setProfitMargin(Number(e.target.value) || 0)}
          className={cn(fieldClass, "mt-2 py-2.5 text-center")}
        />
      </div>

      <div className="rounded-lg bg-brand-900 p-5 text-white shadow-sm">
        <div className="mb-3 flex items-center justify-between text-sm text-brand-100">
          <span>سعر التكلفة</span>
          <span className="font-semibold">{formatSAR(result.totalCost)}</span>
        </div>
        <div className="border-t border-brand-700 pt-3">
          <p className="mb-1 text-xs text-brand-200">سعر البيع المقترح</p>
          <p className="text-3xl font-extrabold">
            {formatSAR(result.sellingPrice)}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="motion-press w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white transition active:bg-brand-800 disabled:opacity-60"
      >
        {saving ? "جاري الحفظ..." : "حفظ"}
      </button>

      {isEdit && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={deletingConfirm ? "اضغط مرة ثانية لتأكيد الحذف" : "حذف المنتج"}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-3 text-sm font-semibold transition active:bg-red-50 disabled:opacity-60 ${
            deletingConfirm
              ? "border-red-500 bg-red-500 text-white"
              : "border-red-200 text-red-600"
          }`}
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? "جاري الحذف..." : deletingConfirm ? "اضغط مرة ثانية للتأكيد" : "حذف المنتج"}
        </button>
      )}
    </form>
  );
}
