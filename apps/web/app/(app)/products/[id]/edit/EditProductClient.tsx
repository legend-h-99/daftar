"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { apiGet, ApiError } from "@/lib/api";
import { Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ui/form-field";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Product>(`/products/${params.id}`)
      .then((data) => {
        if (!cancelled) setProduct(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "تعذر تحميل المنتج");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">
          حاسبة تكلفة المنتج
        </h1>
        <p className="text-sm text-gray-500">عدّل مكونات منتجك وسعره</p>
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
