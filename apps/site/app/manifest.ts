import { colors } from "@chatjs/brand/identity";
import { siteConfig, siteLinks } from "@/lib/site-config";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: colors.background,
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
    name: `${siteConfig.name} - Building blocks for your AI app`,
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
    theme_color: colors.background,
  };
}
