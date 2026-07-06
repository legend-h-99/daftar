import Link from "next/link";
import { FileText, ShoppingCart, Wallet } from "lucide-react";

const LINKS = [
  { href: "/invoices", label: "الفواتير", icon: FileText, color: "text-brand-700 bg-brand-50" },
  { href: "/purchases", label: "المشتريات", icon: ShoppingCart, color: "text-amber-700 bg-amber-50" },
  { href: "/expenses", label: "المصاريف", icon: Wallet, color: "text-red-600 bg-red-50" },
];

/** روابط سريعة أسفل التقرير لأقسام الفواتير والمشتريات والمصاريف. */
export default function ReportQuickLinks() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LINKS.map(({ href, label, icon: Icon, color }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-3 shadow-sm active:bg-gray-50"
        >
          <span className={`rounded-lg p-1.5 ${color}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold text-gray-600">{label}</span>
        </Link>
      ))}
    </div>
  );
}
