/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/db/eve-documents"; "../../lib/db/eve-queries"; "../../lib/eve/conversation-scope"; "../../lib/eve/project-instructions" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineHook } from "eve/hooks";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  captureEveDocumentCheckpoint,
  captureEveNamedDocumentCheckpoint,
} from "../../lib/db/eve-documents";
/* oxlint-enable sort-imports */
import { getEveConversationProject } from "../../lib/db/eve-queries";
import { resolveEveConversationScope } from "../../lib/eve/conversation-scope";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { projectInstructions } from "../../lib/eve/project-instructions";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * no-magic-numbers (#517): default export uses 10_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): default export uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts event; context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): default export preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export default defineHook({
  events: {
    "session.waiting": async (event, context) => {
      if (context.session.parent || !event.data.checkpoint) {
        return;
      }
      const scope = await resolveEveConversationScope(
        context.session.auth.initiator?.principalId,
        context.session.id,
        AbortSignal.timeout(10_000),
        context.session.auth.initiator?.attributes.chatjsReservationId
      );
      await captureEveNamedDocumentCheckpoint(
        scope.ownerId,
        scope.conversationId,
        event.data.checkpoint.checkpointId,
        Number(event.data.checkpoint.beforeTurnId.slice("turn_".length))
      );
    },
    "turn.started": async (event, context) => {
      projectInstructions.update(() => ({ content: null }));
      const scope = await resolveEveConversationScope(
        context.session.auth.initiator?.principalId,
        context.session.parent?.rootSessionId ?? context.session.id,
        AbortSignal.timeout(10_000),
        // Native lineage identifies the existing root binding. An inherited
        // reservation attribute never authorizes a child to claim that binding.
        context.session.parent
          ? undefined
          : context.session.auth.initiator?.attributes.chatjsReservationId
      );
      const project = await getEveConversationProject(
        scope.ownerId,
        scope.conversationId
      );
      projectInstructions.update(() => ({
        content: project?.instructions ?? null,
      }));
      // Child turn indices and checkpoint IDs belong to the child's transcript.
      if (!context.session.parent) {
        await captureEveDocumentCheckpoint(
          scope.ownerId,
          scope.conversationId,
          event.data.sequence
        );
      }
    },
  },
});
/* oxlint-enable import/no-default-export, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */
