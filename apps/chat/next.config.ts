import type { NextConfig } from "next";

function appHostname(): string[] {
  if (!process.env.APP_URL) {
    return [];
  }
  try {
    return [new URL(process.env.APP_URL).hostname];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: appHostname(),
  typedRoutes: true,
  cacheComponents: false,
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
  serverExternalPackages: ["pino", "pino-pretty"],
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

export default nextConfig;
