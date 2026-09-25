import { defineState } from "eve/context";
import { defineHook } from "eve/hooks";

import { indexEveSearchText } from "../../lib/db/eve-search";
import { resolveEveConversationScope } from "../../lib/eve/conversation-scope";
import { eveEventSearchText } from "../../lib/eve/search-text";
import type { EveSearchText } from "../../lib/eve/search-text";

const pending = defineState<EveSearchText[]>("chatjs.search-prefix", () => []);

export default defineHook({
  events: {
    "*": async (event, context) => {
      if (context.session.parent) {
        return;
      }
      const entries = eveEventSearchText(event);
      // History can arrive before the native creation receipt can bind the session.
      // Saved copies are indexed atomically by their dispatch transaction.
      if (
        event.type === "history.restored" ||
        event.type === "history.seeded"
      ) {
        pending.update(() => [...pending.get(), ...entries]);
        return;
      }
      if (event.type !== "turn.started" && !entries.length) {
        return;
      }
      pending.update(() => [...pending.get(), ...entries]);
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
