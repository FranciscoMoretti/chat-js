/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers --
 * jsdoc/require-param (#534): authSessionOptions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): authSessionOptions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): authSessionOptions uses 0, 16, 60, 5 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
/** Localhost cookies span ports. Isolate local app/database pairs, and check
 * the database on every development request so resets cannot leave ghost users. */
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers */
