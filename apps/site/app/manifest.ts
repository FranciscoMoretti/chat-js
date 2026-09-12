import type { MetadataRoute } from "next";

import { siteConfig, siteLinks } from "@/lib/site-config";

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
