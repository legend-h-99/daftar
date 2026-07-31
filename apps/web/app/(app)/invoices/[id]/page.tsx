import InvoiceDetailClient from "./InvoiceDetailClient";

export function generateStaticParams() {
  return [{ id: "demo" }];
}

export const dynamicParams = false;

export default function InvoiceDetailPage() {
  return <InvoiceDetailClient />;
}
