/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): authSessionOptions uses 0, 16, 60, 5 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
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
      .slice(0, 16);
    cookiePrefix = `chatjs-dev-${scope}`;
  }
  return {
    advanced: { cookiePrefix },
    session: {
      cookieCache: { enabled: !development, maxAge: 60 * 5 },
    },
  };
};
/* oxlint-enable no-magic-numbers */
