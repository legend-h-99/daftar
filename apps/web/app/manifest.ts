import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "دفتر — إدارة الحسابات",
    short_name: "دفتر",
    description: "تابع مبيعاتك ومصاريفك وفواتيرك بكل سهولة",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8f7",
    theme_color: "#0f7353",
    lang: "ar",
    dir: "rtl",
    categories: ["finance", "business"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
