/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "@better-auth/electron" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
import { authSessionOptions } from "./auth-session-options";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "@/lib/env";
import { lastLoginMethod } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

// oxlint-disable-next-line sort-imports -- Keep env createEnv validation before config applyDefaults validation and electron-auth-plugin construction; alphabetizing these runtime declarations can change which initialization error is observed first.
import { config } from "./config";
import { db } from "./db/client";
import { schema } from "./db/schema";
// oxlint-disable-next-line sort-imports -- Keep env createEnv validation before config applyDefaults validation and electron-auth-plugin construction; alphabetizing these runtime declarations can change which initialization error is observed first.
import { ELECTRON_TRUSTED_ORIGINS } from "./electron-auth";
import { electronAuthPlugin } from "./electron-auth-plugin";
import { getBaseUrl } from "./url";
/* oxlint-enable import/max-dependencies */

/* oxlint-disable node/no-process-env -- Preserve the deployment environment read at the existing configuration boundary. */
let baseUrl = env.APP_URL;
if (typeof baseUrl !== "string" || baseUrl === "") {
  /* oxlint-disable no-ternary -- Preserve lazy selection of the production URL or runtime base URL; pinned unicorn/prefer-ternary requires this value selection. */
  baseUrl =
    process.env.VERCEL_ENV === "production" ? config.appUrl : getBaseUrl();
  /* oxlint-enable no-ternary */
}
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (auth); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable node/no-process-env */

interface SocialProviderCredentials {
  clientId: string;
  clientSecret: string;
}

/* oxlint-disable no-magic-numbers, no-undefined, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): auth uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): auth uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-boolean-expressions (#610): auth intentionally keeps the existing falsy-value behavior of env.VERCEL_URL; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const auth = betterAuth({
  baseURL: baseUrl,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [
    lastLoginMethod(),
    nextCookies(),
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(config.desktopApp.enabled ? [electronAuthPlugin] : []),
  ],
  secret: env.AUTH_SECRET,

  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing authSessionOptions({     baseUrl,     databaseUrl: env.DATABASE_URL,     development: env.NODE_ENV === "development",   }) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
      // oxlint-disable-next-line no-ternary -- Keep google as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      typeof googleId === "string" &&
      googleId.length > 0 &&
      typeof googleSecret === "string" &&
      googleSecret.length > 0
        ? { clientId: googleId, clientSecret: googleSecret }
        : undefined;

    const github =
      // oxlint-disable-next-line no-ternary -- Keep github as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      typeof githubId === "string" &&
      githubId.length > 0 &&
      typeof githubSecret === "string" &&
      githubSecret.length > 0
        ? { clientId: githubId, clientSecret: githubSecret }
        : undefined;

    const vercel =
      // oxlint-disable-next-line no-ternary -- Keep vercel as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(env.VERCEL_URL ? [`https://${env.VERCEL_URL}`] : []),
    config.appUrl,
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(config.desktopApp.enabled ? ELECTRON_TRUSTED_ORIGINS : []),
  ],
});
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (Session); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

// Infer session type from the auth instance for type safety
export type Session = typeof auth.$Infer.Session;
/* oxlint-enable import/no-named-export */
