import { completeEveConversationDeletion } from "@/lib/db/eve-deletion";

import { requireEveDeletionLifecycle } from "./deletion-lifecycle";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { purgeLocalEveFamilyResources } from "./purge-local-resources";
/* oxlint-enable sort-imports */
import { retireEveSessionForDeletion } from "./retire-session";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deleteLocalEveConversationFamily); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteLocalEveConversationFamily's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): deleteLocalEveConversationFamily's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): deleteLocalEveConversationFamily's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): deleteLocalEveConversationFamily keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep deleteLocalEveConversationFamily's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep deleteLocalEveConversationFamily's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): deleteLocalEveConversationFamily intentionally keeps the existing falsy-value behavior of conversation.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Internal local-provider entry point. appRoot is the trusted worker root, never user input. */
export const deleteLocalEveConversationFamily = async (
  ownerId: string,
  conversationId: string,
  appRoot: string
) => {
  const lifecycle = requireEveDeletionLifecycle();
  // Retirement receipts make this replayable even after some native payloads were erased.
  const family = await purgeLocalEveFamilyResources(
    ownerId,
    conversationId,
    appRoot
  );
  if (!family) {
    return;
  }
  for (const conversation of family.conversations) {
    if (!conversation.sessionId) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    const { sessionId } = conversation;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    await lifecycle.purge(sessionId, async () => {
      await retireEveSessionForDeletion(ownerId, sessionId);
    });
  }
  await completeEveConversationDeletion(ownerId, family.rootId);
  // oxlint-disable-next-line typescript/consistent-return -- #580: deleteLocalEveConversationFamily has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return { rootId: family.rootId };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
