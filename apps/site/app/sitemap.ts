import type { MetadataRoute } from "next";

/* oxlint-disable eslint/sort-imports -- the @/lib/site-config import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { siteLastModified, siteLinks } from "@/lib/site-config";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-default-export -- sitemap: This framework/tool loader consumes the default entrypoint; changing export shape would break discovery. */
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
/* oxlint-enable import/no-default-export */
