import { z } from "zod";

import { conversationBinding } from "./contracts";
import { eveCopyInput } from "./copy-input";
import type { EveCopyInput } from "./copy-input";

const COPY_REQUEST_TIMEOUT_MS = 45_000;

const keyFor = (ownerId: string, sourceId: string): string =>
  `chatjs.eve.pending-copy:${ownerId}:${sourceId.toLowerCase()}`;

type CopyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/* oxlint-disable max-params, typescript/strict-boolean-expressions --
 max-params (#511): preparePendingEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/strict-boolean-expressions (#610): preparePendingEveCopy intentionally keeps the existing falsy-value behavior of saved; distinguishing empty, zero, and absent states requires a domain behavior decision.  */
const preparePendingEveCopy = (
  storage: CopyStorage,
  ownerId: string,
  sourceConversationId: string,
  modelId: string
): EveCopyInput => {
  const key = keyFor(ownerId, sourceConversationId);
  const saved = storage.getItem(key);
  const input = eveCopyInput.parse(
    saved
      ? JSON.parse(saved)
      : { modelId, operationId: crypto.randomUUID(), sourceConversationId }
  );
  if (input.sourceConversationId !== sourceConversationId.toLowerCase()) {
    throw new Error("The saved copy request does not match this conversation.");
  }
  storage.setItem(key, JSON.stringify(input));
  return input;
};
/* oxlint-enable max-params, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/strict-boolean-expressions --
 typescript/strict-boolean-expressions (#610): finishPendingEveCopy intentionally keeps the existing falsy-value behavior of stored; distinguishing empty, zero, and absent states requires a domain behavior decision.  */
const finishPendingEveCopy = (
  storage: CopyStorage,
  ownerId: string,
  input: EveCopyInput
): void => {
  const key = keyFor(ownerId, input.sourceConversationId);
  const stored = storage.getItem(key);
  if (
    stored &&
    eveCopyInput.parse(JSON.parse(stored)).operationId === input.operationId
  ) {
    storage.removeItem(key);
  }
};
/* oxlint-enable typescript/strict-boolean-expressions */

class EveCopyRequestError extends Error {
  public readonly retryable: boolean;
  public readonly conversationId?: string;
  public constructor(
    message: string,
    retryable = true,
    conversationId?: string
  ) {
    super(message);
    this.name = "EveCopyRequestError";
    this.retryable = retryable;
    this.conversationId = conversationId;
  }
}

/* oxlint-disable max-statements, no-undefined --
 max-statements (#512): requestEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): requestEveCopy uses undefined for absent or optional values; substituting null would alter its type and serialization contract. */
const requestEveCopy = async (
  input: EveCopyInput
): Promise<z.output<typeof conversationBinding>> => {
  const signal = AbortSignal.timeout(COPY_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api/agent-conversation-copies", {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal,
    });
    if (!response.ok) {
      const failure = z
        .object({
          conversationId: z.uuid().optional(),
          error: z.string(),
          retryable: z.boolean().optional(),
        })
        .safeParse(
          await response.json().catch((): void => {
            // The failure schema rejects an absent JSON body.
          })
        );
      throw new EveCopyRequestError(
        failure.success
          ? failure.data.error
          : "Unable to save. Sign in and retry the same copy.",
        failure.success ? failure.data.retryable !== false : true,
        failure.success ? failure.data.conversationId : undefined
      );
    }
    return conversationBinding.parse(await response.json());
  } catch (error) {
    if (signal.aborted) {
      throw new EveCopyRequestError(
        "Saving is taking longer than expected. Retry to recover the same copy."
      );
    }
    if (error instanceof EveCopyRequestError) {
      throw error;
    }
    throw new EveCopyRequestError(
      "Saving is unconfirmed. Retry to recover the same copy."
    );
  }
};
/* oxlint-enable max-statements, no-undefined */
export {
  EveCopyRequestError,
  finishPendingEveCopy,
  preparePendingEveCopy,
  requestEveCopy,
};
