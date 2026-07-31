import EditProductClient from "./EditProductClient";

export function generateStaticParams() {
  return [{ id: "demo" }];
}

export const dynamicParams = false;

export default function EditProductPage() {
  return <EditProductClient />;
}
