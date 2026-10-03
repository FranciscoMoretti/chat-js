import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/lib/url";

const sitemap = (): MetadataRoute.Sitemap => {
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
};

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default sitemap;
/* oxlint-enable import/no-default-export */
