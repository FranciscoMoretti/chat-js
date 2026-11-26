import type { NextConfig } from "next";
import { siteConfig } from "./lib/site-config";

const nextConfig: NextConfig = {
  // oxlint-disable-next-line eslint/require-await -- Next requires a Promise of rewrites.
  rewrites: async () => {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    const docsUrl =
      process.env.NEXT_PUBLIC_CHATJS_DOCS_URL ?? siteConfig.docsUrl;
    return [{ source: "/docs/:path*", destination: `${docsUrl}/:path*` }];
  },
  experimental: {
    optimizePackageImports: [
      "@hugeicons/core-free-icons",
      "@phosphor-icons/react",
      "@tabler/icons-react",
      "@remixicon/react",
    ],
  },
};

export default nextConfig;
