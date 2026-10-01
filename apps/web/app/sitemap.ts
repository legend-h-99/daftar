import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE_URL = "https://daftar1.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/login/`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/privacy/`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
