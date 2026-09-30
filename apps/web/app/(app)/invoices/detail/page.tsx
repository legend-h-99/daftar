"use client";

import { useEffect, useState } from "react";
import InvoiceDetailClient from "../[id]/InvoiceDetailClient";
import { ErrorAlert } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";

export default function InvoiceDetailRoute() {
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setInvoiceId(new URLSearchParams(window.location.search).get("id"));
    setReady(true);
  }, []);

  if (!ready) return <Skeleton className="h-64 rounded-2xl" />;
  if (!invoiceId) return <ErrorAlert>تعذر تحديد الفاتورة المطلوبة</ErrorAlert>;
  return <InvoiceDetailClient invoiceId={invoiceId} />;
}
