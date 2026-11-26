import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // oxlint-disable-next-line eslint/require-await -- Next requires a Promise of rewrites.
  rewrites: async () => {
    const docsUrl = process.env.NEXT_PUBLIC_CHATJS_DOCS_URL;
    if (process.env.NODE_ENV !== "development" || docsUrl === undefined) {
      return [];
    }
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
