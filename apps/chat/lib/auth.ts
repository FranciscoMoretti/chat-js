/* oxlint-disable import/max-dependencies  --
 * import/max-dependencies (#524): import from "@better-auth/electron" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { electron } from "@better-auth/electron";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { lastLoginMethod } from "better-auth/plugins";

import { env } from "@/lib/env";

import { authSessionOptions } from "./auth-session-options";
import { config } from "./config";
import { db } from "./db/client";
import { schema } from "./db/schema";
import {
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
  ELECTRON_TRUSTED_ORIGINS,
} from "./electron-auth";
import { getBaseUrl } from "./url";
/* oxlint-enable import/max-dependencies */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): BetterAuthOptions uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type BetterAuthOptions = Parameters<typeof betterAuth>[0];
/* oxlint-enable no-magic-numbers */
type BetterAuthPlugin = NonNullable<BetterAuthOptions["plugins"]>[number];

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The Electron plugin adapter bridges installed Better Auth plugin types; removing the compatibility assertion requires coordinated dependency/API migration.
const electronAuthPlugin = electron({
  clientID: ELECTRON_AUTH_CLIENT_ID,
  cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
}) as unknown as BetterAuthPlugin;
/* oxlint-disable node/no-process-env, typescript/strict-boolean-expressions  --
 * no-ternary (#518): baseUrl derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * node/no-process-env (#537): baseUrl reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/strict-boolean-expressions (#610): baseUrl intentionally keeps the existing falsy-value behavior of env.APP_URL; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const baseUrl =
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
  env.APP_URL ||
  (process.env.VERCEL_ENV === "production" ? config.appUrl : getBaseUrl());
/* oxlint-enable node/no-process-env, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/strict-boolean-expressions  --
 * import/no-named-export (#527): Preserve the named auth API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): auth uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): auth derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): auth uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-rest-spread-properties (#543): auth copies or separates ...authSessionOptions({ baseUrl, databaseUrl: env.DATABASE_URL, development: env.NODE while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep auth's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
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
    ...(config.desktopApp.enabled ? [electronAuthPlugin] : []),
  ],
  secret: env.AUTH_SECRET,

  ...authSessionOptions({
    baseUrl,
    databaseUrl: env.DATABASE_URL,
    development: env.NODE_ENV === "development",
  }),

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

    return { github, google, vercel } as const;
  })(),
  trustedOrigins: [
    baseUrl,
    // Vercel URL for preview branches
    ...(env.VERCEL_URL ? [`https://${env.VERCEL_URL}`] : []),
    config.appUrl,
    ...(config.desktopApp.enabled ? ELECTRON_TRUSTED_ORIGINS : []),
  ],
});
/* oxlint-enable no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/strict-boolean-expressions */

// Infer session type from the auth instance for type safety
export type Session = typeof auth.$Infer.Session;
