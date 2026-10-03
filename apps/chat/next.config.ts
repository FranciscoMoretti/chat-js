/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { withEve } from "eve/next";
import type { NextConfig } from "next";
/* oxlint-enable sort-imports */

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

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default withEve(nextConfig, {
  agents: { chat: ".", guest: "./guest" },
  devServerTimeoutMs: 600_000,
});
/* oxlint-enable import/no-default-export */
