import EditProductClient from "./EditProductClient";

export function generateStaticParams() {
  return [{ id: "demo" }];
}

export const dynamicParams = false;

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditProductClient productId={id} />;
}
