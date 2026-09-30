"use client";

import { useEffect, useState } from "react";
import EditProductClient from "../../[id]/edit/EditProductClient";
import { ErrorAlert } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditProductRoute() {
  const [productId, setProductId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProductId(new URLSearchParams(window.location.search).get("id"));
    setReady(true);
  }, []);

  if (!ready) return <Skeleton className="h-64 rounded-2xl" />;
  if (!productId) return <ErrorAlert>تعذر تحديد المنتج المطلوب</ErrorAlert>;
  return <EditProductClient productId={productId} />;
}
