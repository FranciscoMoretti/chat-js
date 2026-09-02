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
      lastModified: siteLastModified,
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
