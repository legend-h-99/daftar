export function generateStaticParams() {
  return [{ id: "demo" }];
}

export const dynamicParams = false;

export default function ProductIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
