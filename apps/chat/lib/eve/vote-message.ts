import { Client, defaultMessageReducer } from "eve/client";
import { assertEveConfigured } from "./server";
import { getEveConnectionOptions } from "./connection-options";
import { getEveConversation } from "@/lib/db/eve-queries";
import { saveEveMessageVote } from "@/lib/db/queries";

const VOTE_SNAPSHOT_TIMEOUT_MS = 15_000;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (voteEveMessage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve voteEveMessage's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-statements, unicorn/no-null --
 * max-statements (#512): Verify the bound conversation, replay its snapshot, and check assistant-message membership before saving the vote; the guards and reducer state belong to this authorization operation.
 * unicorn/no-null (#570): voteEveMessage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const voteEveMessage = async (
  ownerId: string,
  input: {
    readonly conversationId: string;
    readonly messageId: string;
    readonly type: "up" | "down";
  }
): Promise<Awaited<ReturnType<typeof saveEveMessageVote>>> => {
  const conversation = await getEveConversation(ownerId, input.conversationId);

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, unicorn/no-null */
