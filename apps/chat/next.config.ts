import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    optimizePackageImports: [
      "react-tweet",
      "echarts-for-react",
      "lucide-react",
    ],
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        hostname: "*.googleusercontent.com",
        pathname: "**",
        protocol: "https",
      },
      {
        hostname: "avatars.githubusercontent.com",
      },
      {
        hostname: "*.public.blob.vercel-storage.com",
      },
      { hostname: "www.google.com" },
      {
        hostname: "models.dev",
      },
    ],
  },
  partialPrefetching: true,
  serverExternalPackages: ["pino", "pino-pretty"],
  transpilePackages: ["@chat-js/gateways"],
  typedRoutes: true,
};

export default nextConfig;
