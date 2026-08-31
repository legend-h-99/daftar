"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, FileText, Wallet, Boxes } from "lucide-react";
import { useLanguage } from "@/lib/language";

const TABS = [
  { href: "/dashboard", label: { ar: "الرئيسية", en: "Home" }, icon: Home },
  { href: "/invoices", label: { ar: "الفواتير", en: "Invoices" }, icon: FileText },
  { href: "/purchases", label: { ar: "المشتريات", en: "Purchases" }, icon: ShoppingCart },
  { href: "/expenses", label: { ar: "المصاريف", en: "Expenses" }, icon: Wallet },
  { href: "/inventory", label: { ar: "المخزون", en: "Stock" }, icon: Boxes },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { language } = useLanguage();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === "/inventory" && pathname.startsWith("/products"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="motion-press flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
            >
              <Icon
                className={`h-6 w-6 transition-transform duration-150 ${
                  active ? "scale-110 text-primary" : "text-muted-foreground"
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={active ? "text-primary font-semibold" : "text-muted-foreground"}>
                {label[language]}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
