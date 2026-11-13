import type { Metadata } from "next";
import "./style.css";
export const metadata: Metadata = {
  title: "دفتر | غرفة العمليات",
  description: "مساحة خاصة لإدارة دفتر",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
