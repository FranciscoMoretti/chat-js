import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    preloadEntriesOnStart: false,
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
  serverExternalPackages: ["pino", "pino-pretty", "microsandbox"],
  transpilePackages: ["@chat-js/gateways"],
  typedRoutes: true,
};

export default withEve(nextConfig, {
  agents: { chat: ".", guest: "./guest" },
  devServerTimeoutMs: 600_000,
});
