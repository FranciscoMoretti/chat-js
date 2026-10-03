import type { MetadataRoute } from "next";

import { siteLinks } from "@/lib/site-config";

/* oxlint-disable import/no-default-export -- robots: This framework/tool loader consumes the default entrypoint; changing export shape would break discovery. */
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
/* oxlint-enable import/no-default-export */
