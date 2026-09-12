import { withEve } from "eve/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@chat-js/gateways"],
  cacheComponents: true,
  partialPrefetching: true,
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
  serverExternalPackages: ["pino", "pino-pretty", "microsandbox"],
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "**",
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
};

// Keep production routing behind the existing migration review gate.
export default process.env.EVE_ENABLED === "true"
  ? (phase: string) =>
      phase === "phase-development-server"
        ? withEve(nextConfig, { devServerTimeoutMs: 600_000 })(phase, {
            defaultConfig: nextConfig,
          })
        : nextConfig
  : nextConfig;
