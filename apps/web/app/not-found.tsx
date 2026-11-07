import type { Metadata } from "next";
import NotFoundContent from "@/components/NotFoundContent";

export const metadata: Metadata = {
  // Next adds `noindex` to the not-found page itself.
  title: "الصفحة غير موجودة (404) — دفتر",
};

export default function NotFound() {
  return <NotFoundContent />;
}
