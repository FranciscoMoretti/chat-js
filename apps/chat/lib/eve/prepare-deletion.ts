/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-native-purge"; "../env" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { prepareEveNativeSessionPurge } from "../db/eve-native-purge";
import { env } from "../env";
import {
  retireEveFamilyForDeletion,
  retireEveSessionForDeletion,
} from "./retire-session";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions  --
 * import/no-named-export (#527): Preserve the named prepareEveFamilyDeletion API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): prepareEveFamilyDeletion remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): prepareEveFamilyDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): prepareEveFamilyDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): prepareEveFamilyDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): prepareEveFamilyDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): prepareEveFamilyDeletion sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): prepareEveFamilyDeletion copies or separates ...inventory; ...family while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep prepareEveFamilyDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep prepareEveFamilyDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): prepareEveFamilyDeletion intentionally keeps the existing falsy-value behavior of databaseUrl; sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Authorize and retire the whole family before fencing work for external-resource inventory. */
export const prepareEveFamilyDeletion = async (
  ownerId: string,
  conversationId: string
) => {
  const family = await retireEveFamilyForDeletion(ownerId, conversationId);
  if (!family) {
    return;
  }
  const databaseUrl = env.WORKFLOW_POSTGRES_URL;
  if (
    resolveWorkflowWorld(env) !== "@workflow/world-postgres" ||
    !databaseUrl
  ) {
    throw new Error(
      "This deletion operation requires the PostgreSQL workflow backend."
    );
  }
  const nativeInventories: {
    sessionId: string;
    runIds: string[];
    streamIds: string[];
  }[] = [];
  const runIds = new Set<string>();
  const streamIds = new Set<string>();
  for (const conversation of family.conversations) {
    const { sessionId } = conversation;
    if (!sessionId) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    const inventory = await prepareEveNativeSessionPurge(
      databaseUrl,
      { sessionId, taskIdentifier: "workflow_flows" },
      async () => {
        await retireEveSessionForDeletion(ownerId, sessionId);
      }
    );
    nativeInventories.push({ sessionId, ...inventory });
    for (const id of inventory.runIds) {
      runIds.add(id);
    }
    for (const id of inventory.streamIds) {
      streamIds.add(id);
    }
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: prepareEveFamilyDeletion has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return {
    ...family,
    nativeInventories,
    runIds: [...runIds].toSorted(),
    streamIds: [...streamIds].toSorted(),
  };
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
