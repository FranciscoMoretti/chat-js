import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/lib/url";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 1,
      url: `${baseUrl}/`,
    },
  ];

  return staticEntries;
}
