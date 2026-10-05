import { Client, defaultMessageReducer } from "eve/client";

import { getEveConversation } from "@/lib/db/eve-queries";
import { saveEveMessageVote } from "@/lib/db/queries";

import { getEveConnectionOptions } from "./connection-options";
import { assertEveConfigured } from "./server";

/* oxlint-disable max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-statements (#512): voteEveMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): voteEveMessage uses 15_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep voteEveMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep voteEveMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): voteEveMessage accepts input: { conversationId: string; messageId: string; type: "up" | "down"; }; state; event; message; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): voteEveMessage intentionally keeps the existing falsy-value behavior of conversation?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): voteEveMessage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
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
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const reducer = defaultMessageReducer();
  const reduceEvent = reducer.reduce.bind(reducer);
  // oxlint-disable-next-line unicorn/no-array-reduce -- Use EVE’s native event reducer and initial state for this projection.
  const { messages } = snapshot.events.reduce(
    (state, event) => reduceEvent(state, event),
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
/* oxlint-enable max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
