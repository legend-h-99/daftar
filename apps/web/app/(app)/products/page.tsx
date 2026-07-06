"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { formatSAR } from "@/lib/format";
import { Product } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Product[]>("/products")
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "تعذر تحميل المنتجات");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">المنتجات</h1>
        <Link
          href="/products/new"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm active:bg-brand-800"
          aria-label="إضافة منتج"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-xl">
          <AlertDescription className="text-red-600 font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {!products && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {products && products.length === 0 && (
        <EmptyState
          icon={Package}
          title="لسه ما أضفت أي منتج"
          description="أضف منتجك الأول واحسب تكلفته وسعر بيعه المقترح بسهولة"
          actionLabel="إضافة منتج"
          actionHref="/products/new"
        />
      )}

      {products && products.length > 0 && (
        <ul className="flex flex-col gap-2">
          {products.map((p) => {
            const margin = p.sellingPrice
              ? Math.round(((p.sellingPrice - p.totalCost) / p.sellingPrice) * 100)
              : 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/products/${p.id}/edit`}
                  className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm active:bg-gray-50"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-900">{p.name}</span>
                    <span className="text-xs text-gray-500">
                      سعر التكلفة {formatSAR(p.totalCost)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="font-bold text-gray-900">
                      {formatSAR(p.sellingPrice)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                      نسبة الربح {margin}%
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
