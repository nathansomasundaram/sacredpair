import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { loadTipsIndex } from "@/lib/site/content";

/** Public pages for search engines. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const tips = await loadTipsIndex("en-US");
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/tips`, changeFrequency: "monthly", priority: 0.8 },
    ...tips.order.map((slug) => ({ url: `${base}/tips/${slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/stories`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
