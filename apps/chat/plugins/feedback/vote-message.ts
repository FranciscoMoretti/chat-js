import { Client, defaultMessageReducer } from "eve/client";
import { assertEveConfigured } from "@/lib/eve/server";
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import {
  getFeedbackConversation,
  saveEveMessageVote,
} from "./feedback-queries";

const VOTE_SNAPSHOT_TIMEOUT_MS = 15_000;

export const voteEveMessage = async (
  ownerId: string,
  input: {
    readonly conversationId: string;
    readonly messageId: string;
    readonly type: "up" | "down";
  }
): Promise<Awaited<ReturnType<typeof saveEveMessageVote>>> => {
  const conversation = await getFeedbackConversation(
    ownerId,
    input.conversationId
  );

  if (
    !conversation ||
    typeof conversation.sessionId !== "string" ||
    conversation.sessionId === "" ||
    conversation.state !== "bound"
  ) {
    return null;
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(VOTE_SNAPSHOT_TIMEOUT_MS) });
  const reducer = defaultMessageReducer();
  const reduceEvent = reducer.reduce.bind(reducer);
  let state = reducer.initial();
  for (const event of snapshot.events) {
    state = reduceEvent(state, event);
  }
  const { messages } = state;
  if (
    !messages.some(
      (message: { readonly id: string; readonly role: string }) =>
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
