import { electron } from "@better-auth/electron";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { lastLoginMethod } from "better-auth/plugins";
import { env } from "@/lib/env";
import { config } from "./config";
import { db } from "./db/client";
import { schema } from "./db/schema";
import {
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
  ELECTRON_TRUSTED_ORIGINS,
} from "./electron-auth";
import { getBaseUrl } from "./url";

type BetterAuthOptions = Parameters<typeof betterAuth>[0];
type BetterAuthPlugin = NonNullable<BetterAuthOptions["plugins"]>[number];

const electronAuthPlugin = electron({
  clientID: ELECTRON_AUTH_CLIENT_ID,
  cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
}) as unknown as BetterAuthPlugin;
const baseUrl =
  env.APP_URL ||
  (process.env.VERCEL_ENV === "production" ? config.appUrl : getBaseUrl());

export const auth = betterAuth({
  baseURL: baseUrl,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: [
    baseUrl,
    // Vercel URL for preview branches
    ...(env.VERCEL_URL ? [`https://${env.VERCEL_URL}`] : []),
    config.appUrl,
    ...(config.desktopApp.enabled ? ELECTRON_TRUSTED_ORIGINS : []),
  ],
  secret: env.AUTH_SECRET,

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes - reduces database queries for session validation
    },
  },

  socialProviders: (() => {
    const googleId = env.AUTH_GOOGLE_ID;
    const googleSecret = env.AUTH_GOOGLE_SECRET;
    const githubId = env.AUTH_GITHUB_ID;
    const githubSecret = env.AUTH_GITHUB_SECRET;
    const vercelId = env.VERCEL_APP_CLIENT_ID;
    const vercelSecret = env.VERCEL_APP_CLIENT_SECRET;

    const google =
      typeof googleId === "string" &&
      googleId.length > 0 &&
      typeof googleSecret === "string" &&
      googleSecret.length > 0
        ? { clientId: googleId, clientSecret: googleSecret }
        : undefined;

    const github =
      typeof githubId === "string" &&
      githubId.length > 0 &&
      typeof githubSecret === "string" &&
      githubSecret.length > 0
        ? { clientId: githubId, clientSecret: githubSecret }
        : undefined;

    const vercel =
      typeof vercelId === "string" &&
      vercelId.length > 0 &&
      typeof vercelSecret === "string" &&
      vercelSecret.length > 0
        ? { clientId: vercelId, clientSecret: vercelSecret }
        : undefined;

    return { google, github, vercel } as const;
  })(),
  plugins: [
    lastLoginMethod(),
    nextCookies(),
    ...(config.desktopApp.enabled ? [electronAuthPlugin] : []),
  ],
});

// Infer session type from the auth instance for type safety
export type Session = typeof auth.$Infer.Session;
