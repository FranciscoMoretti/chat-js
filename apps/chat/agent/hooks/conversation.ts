/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/db/eve-documents"; "../../lib/db/eve-queries"; "../../lib/eve/conversation-scope"; "../../lib/eve/project-instructions" dependency within this package instead of introducing an alias or barrel API.
 */
import {
  captureEveDocumentCheckpoint,
  captureEveNamedDocumentCheckpoint,
} from "../../lib/db/eve-documents";
import type { HookContext } from "eve/hooks";
import { defineHook } from "eve/hooks";

import { getEveConversationProject } from "../../lib/db/eve-queries";
import { projectInstructions } from "../../lib/eve/project-instructions";
import { resolveEveConversationScope } from "../../lib/eve/conversation-scope";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, no-undefined, unicorn/no-null -- import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
no-undefined (#519): default export uses undefined for absent or optional values; context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): default export preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */

const conversationScopeTimeoutMilliseconds = 10_000;

export default defineHook({
  events: {
    "session.waiting": async (
      event: Readonly<{
        data: Readonly<{
          checkpoint?: Readonly<{
            checkpointId: string;
            beforeTurnId: string;
          }> | null;
        }>;
      }>,
      context: Readonly<{
        session: Readonly<
          Pick<HookContext["session"], "id" | "auth" | "parent">
        >;
      }>
    ) => {
      if (context.session.parent || !event.data.checkpoint) {
        return;
      }
      const scope = await resolveEveConversationScope(
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        context.session.auth.initiator?.principalId,
        context.session.id,
        AbortSignal.timeout(conversationScopeTimeoutMilliseconds),
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attributes from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        context.session.auth.initiator?.attributes.chatjsReservationId
      );
      await captureEveNamedDocumentCheckpoint(
        scope.ownerId,
        scope.conversationId,
        event.data.checkpoint.checkpointId,
        Number(event.data.checkpoint.beforeTurnId.slice("turn_".length))
      );
    },
    "turn.started": async (
      event: { readonly data: { readonly sequence: number } },
      context: Readonly<{
        session: Readonly<
          Pick<HookContext["session"], "id" | "auth" | "parent">
        >;
      }>
    ) => {
      projectInstructions.update(() => ({ content: null }));
      const scope = await resolveEveConversationScope(
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        context.session.auth.initiator?.principalId,
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading rootSessionId from context.session.parent; preserve one receiver evaluation, skipped accesses and the existing context.session.id fallback. The app guidance prefers optional chaining.
        context.session.parent?.rootSessionId ?? context.session.id,
        AbortSignal.timeout(conversationScopeTimeoutMilliseconds),
        // Native lineage identifies the existing root binding. An inherited
        // reservation attribute never authorizes a child to claim that binding.
        // oxlint-disable-next-line no-ternary -- Keep resolveEveConversationScope argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        context.session.parent
          ? undefined
          : // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attributes from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
            context.session.auth.initiator?.attributes.chatjsReservationId
      );
      const project = await getEveConversationProject(
        scope.ownerId,
        scope.conversationId
      );
      projectInstructions.update(() => ({
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading instructions from project; preserve one receiver evaluation, skipped accesses and the existing null fallback. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-default-export, no-undefined, unicorn/no-null */
