import { withEve } from "eve/next";
import type { NextConfig } from "next";

// Next config runs before the application module/alias loader.
const guestOnly = process.env.CHATJS_GUEST_ONLY === "true";

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

const configureEve = withEve(nextConfig, {
  agents: guestOnly ? { guest: "./guest" } : { chat: ".", guest: "./guest" },
  devServerTimeoutMs: 600_000,
});

const configureChat = async (...args: Parameters<typeof configureEve>) => {
  const configured = await configureEve(...args);
  const { rewrites } = configured;
  return {
    ...configured,
    rewrites: async () => {
      const rules = await rewrites?.();
      const sections = Array.isArray(rules) ? { afterFiles: rules } : rules;
      return {
        ...sections,
        // Resolve the existing registered-agent URL before EVE's named-agent
        // rewrites. EVE otherwise prepends its rules and misses this alias.
        beforeFiles: [
          ...(guestOnly
            ? []
            : [
                {
                  // Vercel agents are separate services. An external rewrite
                  // re-enters platform routing to select the named service.
                  destination: process.env.VERCEL_URL
                    ? `https://${process.env.VERCEL_URL}/eve/chat/v1/:path*`
                    : "/eve/chat/v1/:path*",
                  source: "/eve/v1/:path*",
                },
              ]),
          ...(sections?.beforeFiles ?? []),
        ],
      };
    },
  };
};

export default configureChat;
