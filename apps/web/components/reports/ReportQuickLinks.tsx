import Link from "next/link";
import { FileText, ShoppingCart, Wallet, ArrowUpLeft } from "lucide-react";
import { useLanguage } from "@/lib/language";

const LINKS = [
  { href: "/invoices", label: "الفواتير", icon: FileText, color: "text-primary bg-accent" },
  { href: "/purchases", label: "المشتريات", icon: ShoppingCart, color: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950" },
  { href: "/expenses", label: "المصاريف", icon: Wallet, color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950" },
];

/** روابط سريعة أسفل التقرير لأقسام الفواتير والمشتريات والمصاريف. */
export default function ReportQuickLinks() {
  const { language } = useLanguage();
  const labels = language === "en" ? ["Invoices", "Purchases", "Expenses"] : LINKS.map((link) => link.label);
  return (
    <section aria-labelledby="report-records-heading" className="rounded-xl border border-border bg-card p-4">
      <h2 id="report-records-heading" className="text-sm font-bold text-foreground">{language === "en" ? "Report details" : "تفاصيل التقرير"}</h2>
      <p className="mt-1 mb-3 text-xs text-muted-foreground">{language === "en" ? "Review the records behind your report figures" : "راجع السجلات المرتبطة بأرقام تقريرك"}</p>
      <div className="divide-y divide-border">
        {LINKS.map(({ href, icon: Icon, color }, index) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={`rounded-lg p-1.5 ${color}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex-1 text-sm font-semibold text-foreground">{labels[index]}</span>
            <ArrowUpLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
