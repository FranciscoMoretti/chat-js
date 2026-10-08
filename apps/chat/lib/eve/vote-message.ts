import { Client, defaultMessageReducer } from "eve/client";

import { getEveConversation } from "@/lib/db/eve-queries";
import { saveEveMessageVote } from "@/lib/db/queries";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveConnectionOptions } from "./connection-options";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveConfigured } from "./server";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (voteEveMessage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve voteEveMessage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable max-statements, no-magic-numbers, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-statements (#512): voteEveMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): voteEveMessage uses 15_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): voteEveMessage intentionally keeps the existing falsy-value behavior of conversation?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from conversation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable max-statements, no-magic-numbers, typescript/strict-boolean-expressions, unicorn/no-null */
