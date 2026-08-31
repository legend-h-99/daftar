"use client";

import * as React from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Accessible bottom-sheet dialog. Handles the WCAG requirements that inline
 * modals were missing (4.1.2, 2.4.3, 2.1.2):
 *  - role="dialog" + aria-modal + aria-labelledby (screen readers announce it)
 *  - moves focus into the sheet on open, returns it to the trigger on close
 *  - traps Tab focus within the sheet
 *  - closes on Escape and on overlay click
 */
export default function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;

    const focusable = () =>
      Array.from(
        sheet?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    const first = focusable()[0];
    (first ?? sheet)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const items = focusable();
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-8 outline-none border border-b-0 border-border"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
