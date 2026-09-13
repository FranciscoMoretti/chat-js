import { setTimeout } from "node:timers/promises";

import { getBoundEveConversationForSession } from "../db/eve-queries";

/** Only trusted native context determines the owner, conversation and fork boundary. */
export async function resolveEveConversationScope(
  ownerId: string | undefined,
  sessionId: string,
  abortSignal: AbortSignal
) {
  abortSignal.throwIfAborted();
  if (!ownerId) {
    throw new Error("Conversation context requires an authenticated owner.");
  }
  // A first-turn tool can start between native acceptance and app binding.
  // Never guess a reservation or authorize by a model-supplied conversation ID.
  for (let attempt = 0; attempt < 21; attempt++) {
    abortSignal.throwIfAborted();
    const conversation = await getBoundEveConversationForSession(
      ownerId,
      sessionId
    );
    if (conversation) {
      return { ownerId, conversationId: conversation.id };
    }
    if (attempt < 20) {
      await setTimeout(250, undefined, { signal: abortSignal });
    }
  }
  throw new Error(
    "Conversation binding is not ready. Retry this conversation operation."
  );
}
