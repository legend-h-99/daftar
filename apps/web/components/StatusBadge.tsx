import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InvoiceStatus } from "@/lib/types";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  PAID: { label: "مدفوعة", className: "bg-green-100 text-green-700 border-green-200" },
  UNPAID: { label: "غير مدفوعة", className: "bg-red-50 text-red-600 border-red-100" },
  PARTIAL: { label: "جزئي", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNPAID;
  return (
    <Badge variant="outline" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
