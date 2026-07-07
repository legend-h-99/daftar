import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "دفتر - إدارة حسابات محلك بسهولة",
  description: "دفتر يساعدك تتابع مبيعاتك ومصاريفك وفواتيرك بكل سهولة، خاص بأصحاب المشاريع الصغيرة.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale/userScalable limits — users must be able to pinch-zoom
  // (WCAG 1.4.4). themeColor darkened to match the brand-700 buttons.
  themeColor: "#0f7353",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cn("font-sans", tajawal.variable)}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
