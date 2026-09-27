import { z } from "zod";

import { retryEveAdmission } from "./admission-retry";
import { conversationBinding } from "./contracts";
import type { createConversationInput } from "./contracts";
import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";

export class CreationRejectedError extends Error {
  readonly projectUnavailable: boolean;
  constructor(message: string, projectUnavailable = false) {
    super(message);
    this.name = "CreationRejectedError";
    this.projectUnavailable = projectUnavailable;
  }
}

/** A timeout is ambiguous: callers must retain the operation until it is bound. */
export const requestConversation = async (
  operation: z.infer<typeof createConversationInput>
) => {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 30_000);
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
          throw new CreationRejectedError(
            failure.error,
            failure.code === "project_not_found"
          );
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
