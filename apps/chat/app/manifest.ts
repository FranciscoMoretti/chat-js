import type { MetadataRoute } from "next";

import { config } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#fff",
    description: config.appDescription,
    display: "standalone",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    name: config.appName,
    short_name: config.appName,
    start_url: "/",
    theme_color: "#fff",
  };
}
