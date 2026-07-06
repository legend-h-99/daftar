import * as React from "react";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * الستايل الموحّد لحقول الإدخال (input / select / textarea) في كل التطبيق.
 * مصدر واحد يطابق DESIGN.md: rounded-2xl، خلفية gray-50، حدود gray-200،
 * فوكس brand-500 مع ring brand-600. للحشو/الحجم السياقي استخدم cn(fieldClass, "…").
 */
export const fieldClass =
  "w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600";

/** عنوان حقل موحّد + تلميح اختياري رمادي. */
export function FieldLabel({
  htmlFor,
  hint,
  children,
}: {
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-semibold text-gray-700"
    >
      {children}
      {hint != null && (
        <span className="font-normal text-gray-500"> {hint}</span>
      )}
    </label>
  );
}

/** تجميعة (عنوان + تلميح + محتوى الإدخال) بدل تكرار div/label في كل حقل. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={htmlFor} hint={hint}>
        {label}
      </FieldLabel>
      {children}
    </div>
  );
}

/** تنبيه خطأ موحّد؛ لا يعرض شيئًا إذا كان المحتوى فارغًا. */
export function ErrorAlert({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <Alert
      variant="destructive"
      className={cn("rounded-xl border-red-200 bg-red-50", className)}
    >
      <AlertDescription className="font-medium text-red-600">
        {children}
      </AlertDescription>
    </Alert>
  );
}
