import { purgeEveNativeSession } from "@/lib/eve/lifecycle/postgres/eve-native-purge";

/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-deletion"; "@/lib/eve/lifecycle/postgres/eve-native-purge"; "../env" dependency within this package instead of introducing an alias or barrel API.
 */
import { completeEveConversationDeletion } from "../db/eve-deletion";
import { env } from "../env";
import { purgeLocalEveFamilyResources } from "./purge-local-resources";
import { retireEveSessionForDeletion } from "./retire-session";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): deleteLocalEveConversationFamily's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): deleteLocalEveConversationFamily's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): deleteLocalEveConversationFamily keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep deleteLocalEveConversationFamily's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep deleteLocalEveConversationFamily's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): deleteLocalEveConversationFamily intentionally keeps the existing falsy-value behavior of databaseUrl; conversation.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Internal local-provider entry point. appRoot is the trusted worker root, never user input. */
export const deleteLocalEveConversationFamily = async (
  ownerId: string,
  conversationId: string,
  appRoot: string
) => {
  const databaseUrl = env.WORKFLOW_POSTGRES_URL;
  if (
    resolveWorkflowWorld(env) !== "@workflow/world-postgres" ||
    !databaseUrl
  ) {
    throw new Error(
      "This deletion operation requires the PostgreSQL workflow backend."
    );
  }
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
    await purgeEveNativeSession(
      databaseUrl,
      { sessionId, taskIdentifier: "workflow_flows" },
      async () => {
        await retireEveSessionForDeletion(ownerId, sessionId);
      }
    );
  }
  await completeEveConversationDeletion(ownerId, family.rootId);
  // oxlint-disable-next-line typescript/consistent-return -- #580: deleteLocalEveConversationFamily has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return { rootId: family.rootId };
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
