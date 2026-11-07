"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "#features", label: "المزايا" },
  { href: "#pricing", label: "الباقات" },
  { href: "#faq", label: "الأسئلة الشائعة" },
];

/** Section links for small screens; hidden from `sm` up where the inline links show. */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        <span className="sr-only">{open ? "إغلاق القائمة" : "فتح القائمة"}</span>
      </button>
      <nav
        id={panelId}
        aria-label="أقسام الصفحة"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-gray-100 bg-white px-5 pb-4 shadow-sm"
      >
        <ul className="flex flex-col">
          {LINKS.map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center border-b border-gray-100 text-base font-semibold text-gray-700 hover:text-brand-700"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
