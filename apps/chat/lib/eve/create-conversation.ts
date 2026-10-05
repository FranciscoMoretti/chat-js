import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { retryEveAdmission } from "./admission-retry";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { conversationBinding } from "./contracts";
/* oxlint-enable sort-imports */
import type { createConversationInput } from "./contracts";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";
/* oxlint-enable sort-imports */

class CreationRejectedError extends Error {
  public readonly projectUnavailable: boolean;
  public constructor(message: string, projectUnavailable = false) {
    super(message);
    this.name = "CreationRejectedError";
    this.projectUnavailable = projectUnavailable;
  }
}

/* oxlint-disable max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types --
max-lines-per-function (#510): requestConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): requestConversation uses 30_000, 503, 400, 404 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): requestConversation accepts operation: z.infer<typeof createConversationInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.  */
/** A timeout is ambiguous: callers must retain the operation until it is bound.
 * @param {z.infer<typeof createConversationInput>} operation Immutable creation intent reused for admission and recovery retries.
 * @returns {Promise<z.infer<typeof conversationBinding>>} The conversation and native session identities accepted for this operation.
 */
const requestConversation = async (
  operation: z.infer<typeof createConversationInput>
): Promise<z.infer<typeof conversationBinding>> => {
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
/* oxlint-enable max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types */
export { CreationRejectedError, requestConversation };
