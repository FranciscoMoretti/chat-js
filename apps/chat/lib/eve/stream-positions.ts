/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../env" dependency within this package instead of introducing an alias or barrel API.
 */
import { env } from "../env";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getEveStreamPositions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveStreamPositions's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): getEveStreamPositions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getEveStreamPositions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): getEveStreamPositions uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep getEveStreamPositions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveStreamPositions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): getEveStreamPositions accepts sessionIds: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): getEveStreamPositions intentionally keeps the existing falsy-value behavior of env.WORKFLOW_POSTGRES_URL; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Optional optimization. Unknown positions must still be reconciled through Eve's stream. */
export const getEveStreamPositions = async (sessionIds: string[]) => {
  if (resolveWorkflowWorld(env) === "vercel" || sessionIds.length === 0) {
    return new Map<string, number>();
  }
  if (!env.WORKFLOW_POSTGRES_URL) {
    throw new Error("Configure WORKFLOW_POSTGRES_URL for local workflows.");
  }
  const { getEvePostgresStreamPositions } =
    await import("@/lib/eve/lifecycle/postgres/eve-stream-positions");
  return await getEvePostgresStreamPositions(
    env.WORKFLOW_POSTGRES_URL,
    sessionIds
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
