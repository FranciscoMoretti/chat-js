import type { MetadataRoute } from "next";

import { config } from "@/lib/config";

const manifest = (): MetadataRoute.Manifest => ({
  background_color: "#fff",
  description: config.appDescription,
  display: "standalone",
  icons: [
    {
      sizes: "any",
      src: "/icon.svg",
      type: "image/svg+xml",
    },
  ],
  name: config.appName,
  short_name: config.appName,
  start_url: "/",
  theme_color: "#fff",
});

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default manifest;
/* oxlint-enable import/no-default-export */
