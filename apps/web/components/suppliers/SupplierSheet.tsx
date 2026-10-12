"use client";

import { FormEvent, useState } from "react";
import { apiPost, apiPatch, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { Supplier } from "@/lib/types";
import { useLanguage } from "@/lib/language";
import BottomSheet from "@/components/BottomSheet";
import { ErrorAlert, Field, fieldClass } from "@/components/ui/form-field";

export default function SupplierSheet({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const isEdit = supplier !== null;

  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError(en ? "Supplier name is required" : "اسم المورد مطلوب");
      return;
    }
    track("workflow_started", { workflow: "supplier" });
    setSaving(true);
    setFormError(null);
    try {
      const body = { name: trimmed, phone: phone.trim() || undefined };
      if (isEdit) {
        await apiPatch(`/suppliers/${supplier.id}`, body);
      } else {
        await apiPost("/suppliers", body);
      }
      onSaved();
      onClose();
    } catch (err) {
      track("workflow_failed", { workflow: "supplier", status: err instanceof ApiError ? err.status : 0 });
      setFormError(
        err instanceof ApiError
          ? err.message
          : en ? "Could not save supplier" : "تعذر حفظ المورد",
      );
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit
    ? en ? "Edit Supplier" : "تعديل المورد"
    : en ? "New Supplier" : "مورد جديد";

  return (
    <BottomSheet title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={en ? "Supplier name" : "اسم المورد"} htmlFor="supplier-name">
          <input
            id="supplier-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setFormError(null); }}
            placeholder={en ? "e.g. Al-Tamween Co." : "مثال: مؤسسة التموين"}
            className={fieldClass}
            autoFocus
          />
        </Field>

        <Field label={en ? "Phone" : "رقم الجوال"} htmlFor="supplier-phone" hint={en ? "(optional)" : "(اختياري)"}>
          <input
            id="supplier-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setFormError(null); }}
            placeholder="05xxxxxxxx"
            className={fieldClass}
          />
        </Field>

        <ErrorAlert>{formError}</ErrorAlert>

        <button
          type="submit"
          disabled={saving}
          className="motion-press w-full rounded-2xl bg-brand-700 py-3.5 text-base font-bold text-white active:bg-brand-800 disabled:opacity-60"
        >
          {saving ? (en ? "Saving..." : "جاري الحفظ...") : (en ? "Save" : "حفظ")}
        </button>
      </form>
    </BottomSheet>
  );
}
