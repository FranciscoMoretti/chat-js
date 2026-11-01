import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
