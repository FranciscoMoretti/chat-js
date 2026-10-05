import { z } from "zod";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { conversationBinding } from "./contracts";
import { eveCopyInput } from "./copy-input";
import type { EveCopyInput } from "./copy-input";

const COPY_REQUEST_TIMEOUT_MS = 45_000;

const keyFor = (ownerId: string, sourceId: string): string =>
  `chatjs.eve.pending-copy:${ownerId}:${sourceId.toLowerCase()}`;

type CopyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/* oxlint-disable max-params -- Existing exported copy preparation API takes storage, owner, source and model separately.  */
const preparePendingEveCopy = (
  storage: CopyStorage,
  ownerId: string,
  sourceConversationId: string,
  modelId: string
): EveCopyInput => {
  const key = keyFor(ownerId, sourceConversationId);
  const saved = storage.getItem(key);
  const input = eveCopyInput.parse(
    saved !== null && saved !== ""
      ? JSON.parse(saved)
      : { modelId, operationId: crypto.randomUUID(), sourceConversationId }
  );
  if (input.sourceConversationId !== sourceConversationId.toLowerCase()) {
    throw new Error("The saved copy request does not match this conversation.");
  }
  storage.setItem(key, JSON.stringify(input));
  return input;
};
/* oxlint-enable max-params */

const finishPendingEveCopy = (
  storage: CopyStorage,
  ownerId: string,
  input: EveCopyInput
): void => {
  const key = keyFor(ownerId, input.sourceConversationId);
  const stored = storage.getItem(key);
  if (
    stored !== null &&
    stored !== "" &&
    eveCopyInput.parse(JSON.parse(stored)).operationId === input.operationId
  ) {
    storage.removeItem(key);
  }
};

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

const copyFailureSchema = z.object({
  conversationId: z.uuid().optional(),
  error: z.string(),
  retryable: z.boolean().optional(),
});

const readCopyFailure = async (
  response: ReadonlyNativeSurface<Response>
): Promise<EveCopyRequestError> => {
  const failure = copyFailureSchema.safeParse(
    await response.json().catch((): void => {
      // The failure schema rejects an absent JSON body.
    })
  );
  return new EveCopyRequestError(
    failure.success
      ? failure.data.error
      : "Unable to save. Sign in and retry the same copy.",
    failure.success ? failure.data.retryable !== false : true,
    // oxlint-disable-next-line no-undefined -- A malformed failure has no optional conversation identity; the constructor preserves absence.
    failure.success ? failure.data.conversationId : undefined
  );
};

const copyRequestError = (
  error: unknown,
  aborted: boolean
): EveCopyRequestError => {
  if (aborted) {
    return new EveCopyRequestError(
      "Saving is taking longer than expected. Retry to recover the same copy."
    );
  }
  return error instanceof EveCopyRequestError
    ? error
    : new EveCopyRequestError(
        "Saving is unconfirmed. Retry to recover the same copy."
      );
};

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
      throw await readCopyFailure(response);
    }
    return conversationBinding.parse(await response.json());
  } catch (error) {
    throw copyRequestError(error, signal.aborted);
  }
};
export {
  EveCopyRequestError,
  finishPendingEveCopy,
  preparePendingEveCopy,
  requestEveCopy,
};
