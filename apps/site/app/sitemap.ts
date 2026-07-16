import type { MetadataRoute } from "next";

import { siteLastModified, siteLinks } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteLinks.home,
      lastModified: siteLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: siteLinks.docs,
      lastModified: siteLastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: siteLinks.threads,
      lastModified: new Date("2026-07-10T00:00:00.000Z"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: siteLinks.docsGettingStarted,
      lastModified: siteLastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
