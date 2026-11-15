"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

// Records a deletion request for manual review. Nothing is deleted by this button.
export default function AccountDeletionRequest({ ar }: { ar: boolean }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(isAuthenticated()), []);
  if (!signedIn) return null;

  async function request() {
    const confirmed = window.confirm(
      ar
        ? "سيُسجَّل طلب حذف حسابك وتُراجعه الإدارة يدويًا. هل تريد المتابعة؟"
        : "A deletion request will be recorded and reviewed manually. Continue?",
    );
    if (!confirmed) return;
    setBusy(true);
    setStatus("idle");
    try {
      await apiPost("/account/deletion-request");
      setStatus("pending");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={busy || status === "pending"}
        onClick={request}
        className="min-h-11 rounded-lg border border-destructive px-4 py-2 text-destructive disabled:opacity-60"
      >
        {status === "pending"
          ? ar ? "تم تسجيل طلب الحذف" : "Deletion request recorded"
          : busy
            ? ar ? "جاري التسجيل..." : "Recording..."
            : ar ? "طلب حذف الحساب" : "Request account deletion"}
      </button>
      {status === "error" && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {ar ? "تعذر تسجيل الطلب، حاول مجددًا أو راسلنا على info@daftar1.com" : "Could not record the request. Try again or write to info@daftar1.com"}
        </p>
      )}
    </div>
  );
}
