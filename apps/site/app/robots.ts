import type { MetadataRoute } from "next";

import { siteLinks } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    host: siteLinks.home,
    rules: {
      allow: "/",
      userAgent: "*",
    },
    sitemap: [siteLinks.sitemap, siteLinks.docsSitemap],
  };
}
