// oxlint-disable-next-line import/no-nodejs-modules -- The server session namespace uses Node's SHA-256 implementation to hash the application/database scope.
import { createHash } from "node:crypto";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (authSessionOptions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

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
      // oxlint-disable-next-line no-magic-numbers -- The cookie namespace uses the first 16 hexadecimal digest characters; preserve its existing scope identifier.
      .slice(0, 16);
    cookiePrefix = `chatjs-dev-${scope}`;
  }
  return {
    advanced: { cookiePrefix },
    session: {
      // oxlint-disable-next-line no-magic-numbers -- The session cookie cache lasts five minutes; maxAge is measured in seconds.
      cookieCache: { enabled: !development, maxAge: 60 * 5 },
    },
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
