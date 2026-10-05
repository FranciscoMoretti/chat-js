/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/db/eve-search"; "../../lib/eve/conversation-scope"; "../../lib/eve/search-backfill"; "../../lib/eve/search-text" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineState } from "eve/context";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { defineHook } from "eve/hooks";
/* oxlint-enable sort-imports */

import { indexEveSearchText } from "../../lib/db/eve-search";
import { resolveEveConversationScope } from "../../lib/eve/conversation-scope";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { backfillEveSearchConversation } from "../../lib/eve/search-backfill";
/* oxlint-enable sort-imports */
import { eveEventSearchText } from "../../lib/eve/search-text";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveSearchText } from "../../lib/eve/search-text";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const maxPendingEntries = 256;
const maxPendingCharacters = 256_000;

const needsRecovery = defineState("chatjs.search-recovery", () => false);
const pending = defineState<EveSearchText[]>("chatjs.search-prefix", () => []);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable import/no-default-export, max-lines-per-function, max-statements, no-console, no-continue, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * max-lines-per-function (#510): default export keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): default export keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): default export emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-continue (#515): default export skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): default export uses 0, 1, 10_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): default export uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts event; context; current; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export default defineHook({
  events: {
    "*": async (event, context) => {
      if (context.session.parent) {
        return;
      }
      const entries = eveEventSearchText(event);
      const restoring =
        event.type === "history.restored" || event.type === "history.seeded";
      if (!restoring && event.type !== "turn.started" && entries.length === 0) {
        return;
      }
      let omitted = 0;
      pending.update((current) => {
        const retained: EveSearchText[] = [];
        const keys = new Set<string>();
        let characters = 0;
        for (const batch of [current, entries]) {
          for (const entry of batch) {
            if (keys.has(entry.key)) {
              continue;
            }
            if (
              retained.length >= maxPendingEntries ||
              characters + entry.text.length > maxPendingCharacters
            ) {
              omitted += 1;
              continue;
            }
            keys.add(entry.key);
            retained.push(entry);
            characters += entry.text.length;
          }
        }
        return retained;
      });
      if (omitted) {
        needsRecovery.update(() => true);
        // Recover from durable EVE events after binding; manual backfill is a fallback.
        console.error(
          "Search retry buffer overflow; automatic snapshot recovery queued. Run search:backfill if retries keep failing.",
          {
            omitted,
            sessionId: context.session.id,
          }
        );
      }
      // History can arrive before the native creation receipt binds the session.
      if (restoring) {
        return;
      }
      if (pending.get().length === 0 && !needsRecovery.get()) {
        return;
      }
      try {
        const scope = await resolveEveConversationScope(
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
          context.session.auth.initiator?.principalId,
          context.session.id,
          AbortSignal.timeout(10_000),
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attributes from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
          context.session.auth.initiator?.attributes.chatjsReservationId
        );
        if (needsRecovery.get()) {
          // Hook events are already durable, so the snapshot includes the current
          // message as well as any restored history omitted from the retry buffer.
          await backfillEveSearchConversation(
            scope.ownerId,
            scope.conversationId,
            context.session.id
          );
          needsRecovery.update(() => false);
        } else {
          await indexEveSearchText(
            scope.ownerId,
            scope.conversationId,
            pending.get()
          );
        }
        pending.update(() => []);
      } catch (error) {
        // Projection failures must not turn a successful chat into turn.failed.
        // Keep the pending text for the next message or turn; backfill also repairs it.
        console.error(
          "Search indexing failed; will retry on the next chat event.",
          {
            name: error instanceof Error ? error.name : "UnknownError",
            stack:
              error instanceof Error
                ? // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading split from error.stack; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
                  error.stack?.split("\n").slice(1).join("\n")
                : undefined,
          }
        );
      }
    },
  },
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-default-export, max-lines-per-function, max-statements, no-console, no-continue, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types */
