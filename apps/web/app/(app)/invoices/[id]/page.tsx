import InvoiceDetailClient from "./InvoiceDetailClient";

export function generateStaticParams() {
  return [{ id: "demo" }];
}

export const dynamicParams = false;

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceDetailClient invoiceId={id} />;
}
