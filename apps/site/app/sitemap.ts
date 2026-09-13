import type { MetadataRoute } from "next";

import { siteLastModified, siteLinks } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "weekly",
      lastModified: siteLastModified,
      priority: 1,
      url: siteLinks.home,
    },
    {
      changeFrequency: "daily",
      lastModified: siteLastModified,
      priority: 0.9,
      url: siteLinks.docs,
    },
    {
      changeFrequency: "weekly",
      lastModified: siteLastModified,
      priority: 0.9,
      url: siteLinks.threads,
    },
    {
      changeFrequency: "weekly",
      lastModified: siteLastModified,
      priority: 0.8,
      url: siteLinks.docsGettingStarted,
    },
  ];
}
