"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language";
export default function SectionNav() {
  const path = usePathname();
  const { language } = useLanguage();
  const en = language === "en";
  const links =
    path.startsWith("/inventory") || path.startsWith("/products")
      ? [
          ["/inventory", "الأصناف والحركات", "Stock and movements"],
          ["/products", "المنتجات والوصفات", "Products and recipes"],
        ]
      : path.startsWith("/purchases") || path.startsWith("/suppliers")
        ? [
            ["/purchases", "المشتريات", "Purchases"],
            ["/suppliers", "الموردون", "Suppliers"],
          ]
        : path.startsWith("/dashboard") ||
            path.startsWith("/reports") ||
            path.startsWith("/funding")
          ? [
              ["/dashboard", "الملخص", "Overview"],
              ["/reports", "التقارير", "Reports"],
              ["/funding", "تمويل المشروع", "Financing"],
            ]
          : [];
  if (!links.length) return null;
  return (
    <nav
      aria-label={en ? "Section navigation" : "التنقل داخل القسم"}
      className="mb-5 flex flex-wrap gap-2 border-b border-gray-200 pb-3"
    >
      {links.map(([href, ar, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            path === href || path.startsWith(href + "/") ? "page" : undefined
          }
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-gray-700 hover:bg-brand-50 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-800"
        >
          {en ? label : ar}
        </Link>
      ))}
    </nav>
  );
}
