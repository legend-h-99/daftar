import { formatSAR } from "@/lib/format";

interface PaymentReminderInput {
  language: "ar" | "en";
  customerName?: string | null;
  invoiceNumber: string | number;
  businessName: string;
  remaining: number;
}

/** Polite payment-reminder text. The seller reviews and sends it from WhatsApp. */
export function buildPaymentReminder({
  language,
  customerName,
  invoiceNumber,
  businessName,
  remaining,
}: PaymentReminderInput): string {
  const name = customerName?.trim();
  if (language === "en") {
    return [
      name ? `Hello ${name},` : "Hello,",
      `A friendly reminder about invoice #${invoiceNumber} from ${businessName}.`,
      `Amount remaining: ${formatSAR(remaining, "en")}`,
      "If it's already paid, please ignore this message. Thank you for your business.",
    ].join("\n");
  }
  return [
    name ? `السلام عليكم ${name}،` : "السلام عليكم،",
    `حبيت أذكّركم بفاتورة رقم ${invoiceNumber} من ${businessName}.`,
    `المبلغ المتبقي: ${formatSAR(remaining)}`,
    "إذا تم الدفع فتجاهلوا الرسالة، وشكرًا لتعاملكم معنا.",
  ].join("\n");
}
