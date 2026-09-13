import { withEve } from "eve/next";
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
  serverExternalPackages: ["pino", "pino-pretty", "microsandbox"],
  transpilePackages: ["@chat-js/gateways"],
  typedRoutes: true,
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
