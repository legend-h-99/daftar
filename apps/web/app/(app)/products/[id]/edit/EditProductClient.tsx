"use client";

import { useEffect, useState } from "react";
import ProductForm from "@/components/ProductForm";
import { apiGet, ApiError } from "@/lib/api";
import { Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ui/form-field";
import { useLanguage } from "@/lib/language";

export default function EditProductClient({ productId }: { productId: string }) {
  const { language } = useLanguage();
  const en = language === "en";
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Product>(`/products/${productId}`)
      .then((data) => {
        if (!cancelled) setProduct(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : en ? "Could not load product" : "تعذر تحميل المنتج");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productId, en]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">
          {en ? "Product cost calculator" : "حاسبة تكلفة المنتج"}
        </h1>
        <p className="text-sm text-gray-500">{en ? "Edit your product ingredients and price" : "عدّل مكونات منتجك وسعره"}</p>
      </div>

      {error && (
        <ErrorAlert>{error}</ErrorAlert>
      )}

      {!product && !error && (
        <Skeleton className="h-64 rounded-2xl" />
      )}

      {product && <ProductForm product={product} />}
    </div>
  );
}
