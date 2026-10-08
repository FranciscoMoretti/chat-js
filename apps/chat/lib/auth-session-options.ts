// oxlint-disable-next-line import/no-nodejs-modules -- The server session namespace uses Node's SHA-256 implementation to hash the application/database scope.
import { createHash } from "node:crypto";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (authSessionOptions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

const COOKIE_NAMESPACE_DIGEST_LENGTH = 16;
const SESSION_CACHE_MAX_AGE_SECONDS = 300;

/**
 * Localhost cookies span ports; isolate local app/database pairs and bypass cached development sessions.
 * @param {{ readonly baseUrl: string; readonly databaseUrl: string; readonly development: boolean; }} options Deployment inputs used to isolate the session cookie namespace.
 * @param {string} options.baseUrl Application URL whose origin contributes to the development scope.
 * @param {string} options.databaseUrl Database URL whose password is removed before hashing the development scope.
 * @param {boolean} options.development Whether each request must recheck the database instead of trusting cookie cache.
 * @returns {{ advanced: { cookiePrefix: string }; session: { cookieCache: { enabled: boolean; maxAge: number } }; }} Cookie prefix and five-minute cache policy; development scopes the prefix and disables the cache.
 */
export const authSessionOptions = ({
  baseUrl,
  databaseUrl,
  development,
}: {
  readonly baseUrl: string;
  readonly databaseUrl: string;
  readonly development: boolean;
}): {
  advanced: { cookiePrefix: string };
  session: { cookieCache: { enabled: boolean; maxAge: number } };
} => {
  let cookiePrefix = "better-auth";
  if (development) {
    const database = new URL(databaseUrl);
    database.password = "";
    const scope = createHash("sha256")
      .update(new URL(baseUrl).origin)
      .update("\0")
      .update(database.toString())
      .digest("hex")
      // oxlint-disable-next-line no-magic-numbers -- Digest slicing starts at its first hexadecimal character, at index zero.
      .slice(0, COOKIE_NAMESPACE_DIGEST_LENGTH);
    cookiePrefix = `chatjs-dev-${scope}`;
  }
  return {
    advanced: { cookiePrefix },
    session: {
      cookieCache: {
        enabled: !development,
        maxAge: SESSION_CACHE_MAX_AGE_SECONDS,
      },
    },
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
