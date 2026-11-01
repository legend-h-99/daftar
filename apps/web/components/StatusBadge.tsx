import { cn } from "@/lib/utils";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_LABELS_EN, InvoiceStatus } from "@/lib/types";
import { useLanguage } from "@/lib/language";

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  PAID: "bg-green-100 text-green-700 border-green-200",
  UNPAID: "bg-red-50 text-red-600 border-red-100",
  PARTIAL: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { language } = useLanguage();
  const known = status in STATUS_CLASSES ? status : "UNPAID";
  const labels = language === "en" ? INVOICE_STATUS_LABELS_EN : INVOICE_STATUS_LABELS;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[known],
      )}
    >
      {labels[known]}
    </span>
  );
}
