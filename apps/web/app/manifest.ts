import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_BASE_PATH || "";

  return {
    name: "دفتر — إدارة الحسابات",
    short_name: "دفتر",
    description: "تابع مبيعاتك ومصاريفك وفواتيرك بكل سهولة",
    start_url: `${basePath}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8f7",
    theme_color: "#0f7353",
    lang: "ar",
    dir: "rtl",
    categories: ["finance", "business"],
    icons: [
      {
        src: `${basePath}/icon`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icon`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${basePath}/apple-icon`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
