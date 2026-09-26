import { defineState } from "eve/context";
import { defineHook } from "eve/hooks";

import { indexEveSearchText } from "../../lib/db/eve-search";
import { resolveEveConversationScope } from "../../lib/eve/conversation-scope";
import { eveEventSearchText } from "../../lib/eve/search-text";
import type { EveSearchText } from "../../lib/eve/search-text";

const maxPendingEntries = 256;
const maxPendingCharacters = 256_000;

const pending = defineState<EveSearchText[]>("chatjs.search-prefix", () => []);

export default defineHook({
  events: {
    "*": async (event, context) => {
      if (context.session.parent) {
        return;
      }
      const entries = eveEventSearchText(event);
      const restoring =
        event.type === "history.restored" || event.type === "history.seeded";
      if (!restoring && event.type !== "turn.started" && !entries.length) {
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
        // Events remain durable in EVE; operators can rebuild omitted entries.
        console.error(
          "Search retry buffer overflow; run search:backfill to recover omitted text.",
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
      if (!pending.get().length) {
        return;
      }
      try {
        const scope = await resolveEveConversationScope(
          context.session.auth.initiator?.principalId,
          context.session.id,
          AbortSignal.timeout(10_000),
          context.session.auth.initiator?.attributes.chatjsReservationId
        );
        await indexEveSearchText(
          scope.ownerId,
          scope.conversationId,
          pending.get()
        );
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
                ? error.stack?.split("\n").slice(1).join("\n")
                : undefined,
          }
        );
      }
    },
  },
});
