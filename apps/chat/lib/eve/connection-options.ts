/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../env" dependency within this package instead of introducing an alias or barrel API.
 */
import { env } from "../env";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): getEveConnectionOptions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getEveConnectionOptions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep getEveConnectionOptions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveConnectionOptions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): getEveConnectionOptions intentionally keeps the existing falsy-value behavior of [env.VERCEL_URL, env.VERCEL_BRANCH_URL].some( (hostname) => hostname && new URL(host); hostname; sameDeployment; env.VERCEL_AUTOMATION_BYPASS_SECRET; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Credentials for the app-to-EVE boundary, shared by HTTP and SDK clients. */
export const getEveConnectionOptions = (
  ownerId: string,
  host = new URL("/eve/chat", env.EVE_INTERNAL_ORIGIN).href
) => {
  const headers: Record<string, string> = { "x-chatjs-owner": ownerId };
  // A separate worker must never receive this Vercel project's credential.
  const sameDeployment =
    host &&
    [env.VERCEL_URL, env.VERCEL_BRANCH_URL].some(
      (hostname) => hostname && new URL(host).origin === `https://${hostname}`
    );
  if (sameDeployment && env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  return {
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers,
    host,
    redirect: "error" as const,
  };
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
