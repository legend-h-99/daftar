"use client";

import { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Customer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/form-field";
import { useLanguage } from "@/lib/language";

/** حقل اختيار الزبون: بحث + قائمة مقترحة + إنشاء زبون جديد بالكتابة. */
export default function InvoiceCustomerField({
  customers,
  query,
  selected,
  onQueryChange,
  onSelect,
  onClear,
}: {
  customers: Customer[];
  query: string;
  selected: Customer | null;
  onQueryChange: (value: string) => void;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const [showList, setShowList] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers.slice(0, 6);
    const q = query.trim();
    return customers.filter((c) => c.name.includes(q)).slice(0, 6);
  }, [customers, query]);

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <label className="mb-1.5 block text-sm font-semibold text-gray-700">
        {en ? "Customer" : "الزبون"} <span className="font-normal text-gray-500">{en ? "(optional)" : "(اختياري)"}</span>
      </label>
      <div className="relative">
        <UserPlus className={`pointer-events-none absolute ${en ? "left-3.5" : "right-3.5"} top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500`} />
        <input
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          placeholder={en ? "Enter a customer name or choose from the list" : "اكتب اسم الزبون أو اختر من القائمة"}
          className={cn(fieldClass, en ? "pl-10" : "pr-10")}
        />
        {query && (
          <button
            type="button"
            onClick={onClear}
            className={`absolute ${en ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-gray-500`}
            aria-label={en ? "Clear" : "مسح"}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {showList && filtered.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c);
                  setShowList(false);
                }}
                className={`w-full px-3 py-2.5 text-sm text-gray-700 active:bg-gray-50 ${en ? "text-left" : "text-right"}`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!selected && query.trim() && (
        <p className="mt-1.5 text-xs text-gray-500">
          {en ? `“${query.trim()}” will be added as a new customer` : <>سيتم إضافة &quot;{query.trim()}&quot; كزبون جديد</>}
        </p>
      )}
    </div>
  );
}
