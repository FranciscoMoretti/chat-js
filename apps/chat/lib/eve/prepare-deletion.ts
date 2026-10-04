import { requireEveDeletionLifecycle } from "./deletion-lifecycle";
import {
  retireEveFamilyForDeletion,
  retireEveSessionForDeletion,
} from "./retire-session";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): prepareEveFamilyDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): prepareEveFamilyDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): prepareEveFamilyDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): prepareEveFamilyDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep prepareEveFamilyDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep prepareEveFamilyDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): prepareEveFamilyDeletion intentionally keeps the existing falsy-value behavior of sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Authorize and retire the whole family before fencing work for external-resource inventory. */
export const prepareEveFamilyDeletion = async (
  ownerId: string,
  conversationId: string
) => {
  const lifecycle = requireEveDeletionLifecycle();
  const family = await retireEveFamilyForDeletion(ownerId, conversationId);
  if (!family) {
    return;
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
    const inventory = await lifecycle.prepare(sessionId, async () => {
      await retireEveSessionForDeletion(ownerId, sessionId);
    });
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
