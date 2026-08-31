"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthLabel } from "@/lib/format";
import { useLanguage } from "@/lib/language";

interface MonthNavProps {
  month: string;
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export function MonthNav({ month, isCurrentMonth, onPrev, onNext, className }: MonthNavProps) {
  const { language } = useLanguage();
  return (
    <div className={`flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm ${className ?? ""}`}>
      <button
        type="button"
        onClick={onPrev}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
        aria-label={language === "ar" ? "الشهر السابق" : "Previous month"}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <span className="text-sm font-bold text-foreground">{formatMonthLabel(month, language)}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={isCurrentMonth}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted disabled:opacity-30"
        aria-label={language === "ar" ? "الشهر التالي" : "Next month"}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
    </div>
  );
}
