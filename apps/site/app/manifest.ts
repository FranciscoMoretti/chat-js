import type { MetadataRoute } from "next";

/* oxlint-disable eslint/sort-imports -- the @/lib/site-config import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { siteConfig, siteLinks } from "@/lib/site-config";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-default-export -- manifest: This framework/tool loader consumes the default entrypoint; changing export shape would break discovery. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f8f7f4",
    categories: ["developer tools", "productivity", "artificial intelligence"],
    description: siteConfig.description,
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        sizes: "48x48",
        src: "/favicon.ico",
        type: "image/x-icon",
      },
    ],
    name: `${siteConfig.name} - Open-Source AI Chat Starter`,
    short_name: siteConfig.shortName,
    shortcuts: [
      {
        name: "Documentation",
        url: siteLinks.docs,
      },
      {
        name: "Demo",
        url: siteLinks.demo,
      },
    ],
    start_url: "/",
    theme_color: "#09090b",
  };
}
/* oxlint-enable import/no-default-export */
