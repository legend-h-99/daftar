import { cn } from "@/lib/utils";
import { InvoiceStatus } from "@/lib/types";
import { useLanguage } from "@/lib/language";

const STATUS_CONFIG: Record<InvoiceStatus, { label: { ar: string; en: string }; className: string }> = {
  PAID: { label: { ar: "مدفوعة", en: "Paid" }, className: "bg-green-100 text-green-700 border-green-200" },
  UNPAID: { label: { ar: "غير مدفوعة", en: "Unpaid" }, className: "bg-red-50 text-red-600 border-red-100" },
  PARTIAL: { label: { ar: "جزئي", en: "Partial" }, className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { language } = useLanguage();
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNPAID;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {config.label[language]}
    </span>
  );
}
