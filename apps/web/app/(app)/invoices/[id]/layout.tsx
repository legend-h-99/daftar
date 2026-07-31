export function generateStaticParams() {
  return [{ id: "demo" }];
}

export const dynamicParams = false;

export default function InvoiceIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
