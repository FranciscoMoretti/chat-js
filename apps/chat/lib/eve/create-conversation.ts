import { z } from "zod";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { retryEveAdmission } from "./admission-retry";
import { conversationBinding } from "./contracts";
import type { createConversationInput } from "./contracts";
import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";

class CreationRejectedError extends Error {
  public readonly code: string | undefined;
  public constructor(message: string, code?: string) {
    super(message);
    this.name = "CreationRejectedError";
    this.code = code;
  }
}

/** A timeout is ambiguous: callers must retain the operation until it is bound.
 * @param {z.infer<typeof createConversationInput>} operation Immutable creation intent reused for admission and recovery retries.
 * @returns {Promise<z.infer<typeof conversationBinding>>} The conversation and native session identities accepted for this operation.
 */
const requestConversation = async (
  operation: ReadonlyNativeSurface<z.infer<typeof createConversationInput>>
): Promise<z.infer<typeof conversationBinding>> => {
  const controller = new AbortController();
  const deadline = setTimeout(() => {
    controller.abort();
  }, 30_000);
  try {
    return await retryEveAdmission(async () => {
      const response = await fetch("/api/agent-conversations", {
        body: JSON.stringify(operation),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const failure = z
          .object({
            code: z.string().optional(),
            creationRejected: z.boolean().optional(),
            error: z.string(),
          })
          .parse(body);
        if (
          response.status === 503 &&
          failure.code === "usage_reconciliation_busy"
        ) {
          throw new EveUsageReconciliationBusyError();
        }
        if (
          (response.status === 400 || response.status === 404) &&
          failure.creationRejected === true
        ) {
          throw new CreationRejectedError(failure.error, failure.code);
        }
        throw new Error(failure.error);
      }
      return conversationBinding.parse(body);
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        "The request timed out. Your message is saved. Retry to check the same conversation.",
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(deadline);
  }
};
export { CreationRejectedError, requestConversation };
