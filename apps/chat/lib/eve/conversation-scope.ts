import { setTimeout } from "node:timers/promises";

import { getBoundEveConversationForSession } from "../db/eve-queries";

/** Only trusted native context determines the owner, conversation and fork boundary. */
export const resolveEveConversationScope = async (
  ownerId: string | undefined,
  sessionId: string,
  abortSignal: AbortSignal
) => {
  abortSignal.throwIfAborted();
  if (!ownerId) {
    throw new Error("Conversation context requires an authenticated owner.");
  }
  // A first-turn tool can start between native acceptance and app binding.
  // Never guess a reservation or authorize by a model-supplied conversation ID.
  for (let attempt = 0; attempt < 21; attempt += 1) {
    abortSignal.throwIfAborted();
    // oxlint-disable-next-line eslint/no-await-in-loop -- Retry only after the preceding attempt and delay have completed.
    const conversation = await getBoundEveConversationForSession(
      ownerId,
      sessionId
    );
    if (conversation) {
      return { conversationId: conversation.id, ownerId };
    }
    if (attempt < 20) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Retry only after the preceding attempt and delay have completed.
      await setTimeout(250, undefined, { signal: abortSignal });
    }
  }
  throw new Error(
    "Conversation binding is not ready. Retry this conversation operation."
  );
};
