"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, FileText, Wallet, Boxes } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "الرئيسية", icon: Home },
  { href: "/invoices", label: "الفواتير", icon: FileText },
  { href: "/purchases", label: "المشتريات", icon: ShoppingCart },
  { href: "/expenses", label: "المصاريف", icon: Wallet },
  { href: "/inventory", label: "المخزون", icon: Boxes },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
            >
              <Icon
                className={`h-6 w-6 ${active ? "text-brand-700" : "text-gray-500"}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={active ? "text-brand-700" : "text-gray-500"}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
