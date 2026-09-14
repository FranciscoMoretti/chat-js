import { Client, defaultMessageReducer } from "eve/client";

import { getEveConversation } from "../db/eve-queries";
import { saveEveMessageVote } from "../db/queries";
import { env } from "../env";
import { assertEveConfigured } from "./server";

export const voteEveMessage = async (
  ownerId: string,
  input: {
    conversationId: string;
    messageId: string;
    type: "up" | "down";
  }
) => {
  const conversation = await getEveConversation(ownerId, input.conversationId);
  if (!(conversation?.sessionId && conversation.state === "bound")) {
    return null;
  }
  assertEveConfigured();
  const client = new Client({
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": ownerId },
    host: env.EVE_INTERNAL_ORIGIN ?? "",
  });
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const reducer = defaultMessageReducer();
  // oxlint-disable-next-line unicorn/no-array-reduce -- Use EVE’s native event reducer and initial state for this projection.
  const { messages } = snapshot.events.reduce(
    reducer.reduce,
    reducer.initial()
  );
  if (
    !messages.some(
      (message) =>
        message.id === input.messageId && message.role === "assistant"
    )
  ) {
    return null;
  }
  return await saveEveMessageVote(
    ownerId,
    input.conversationId,
    input.messageId,
    input.type === "up"
  );
};
