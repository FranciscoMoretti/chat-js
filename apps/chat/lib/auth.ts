import { isNonEmptyString } from "@/lib/is-non-empty-string";

import { authSessionOptions } from "./auth-session-options";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "@/lib/env";
import { lastLoginMethod } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { config } from "./config";
import { db } from "./db/client";
import { schema } from "./db/schema";
import { authentication } from "@/integrations/auth/server";
import { getBaseUrl } from "./url";

let baseUrl = env.APP_URL;
if (typeof baseUrl !== "string" || baseUrl === "") {
  baseUrl =
    process.env.VERCEL_ENV === "production" ? config.appUrl : getBaseUrl();
}

interface SocialProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export const auth = betterAuth({
  baseURL: baseUrl,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [lastLoginMethod(), nextCookies(), ...authentication.plugins],
  secret: env.AUTH_SECRET,

  ...authSessionOptions({
    baseUrl,
    databaseUrl: env.DATABASE_URL,
    development: env.NODE_ENV === "development",
  }),

  socialProviders: ((): {
    readonly github: SocialProviderCredentials | undefined;
    readonly google: SocialProviderCredentials | undefined;
    readonly vercel: SocialProviderCredentials | undefined;
  } => {
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

    return { github, google, vercel };
  })(),
  trustedOrigins: [
    baseUrl,
    // Vercel URL for preview branches
    ...(isNonEmptyString(env.VERCEL_URL) ? [`https://${env.VERCEL_URL}`] : []),
    config.appUrl,
    ...authentication.trustedOrigins,
  ],
});

// Infer session type from the auth instance for type safety
export type Session = typeof auth.$Infer.Session;
