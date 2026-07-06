import * as React from "react";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * الستايل الموحّد لحقول الإدخال (input / select / textarea) في نماذج التطبيق.
 * مصدر واحد بدل تكرار السلسلة في كل صفحة.
 */
export const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-600";

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
