import type { Metadata } from "next";
import LandingContent from "./_content";

export const metadata: Metadata = {
  title: "دفتر — تطبيق محاسبة للمشاريع الصغيرة | Daftar",
  description:
    "تطبيق محاسبة عربي مبسّط للأسر المنتجة والمشاريع الصغيرة في السعودية. تابع مبيعاتك ومصاريفك وفواتيرك وأرباحك من مكان واحد — بدون مصطلحات محاسبية. جرّب مجانًا.",
};

export default function LandingPage() {
  return <LandingContent />;
}
