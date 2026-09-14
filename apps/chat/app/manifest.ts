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

export default manifest;
