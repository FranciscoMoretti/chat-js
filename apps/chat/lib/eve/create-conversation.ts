/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { z } from "zod";

import { retryEveAdmission } from "./admission-retry";
import { conversationBinding } from "./contracts";
import type { createConversationInput } from "./contracts";
import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";
/* oxlint-enable sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): CreationRejectedError stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named CreationRejectedError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export class CreationRejectedError extends Error {
  public readonly projectUnavailable: boolean;
  public constructor(message: string, projectUnavailable = false) {
    super(message);
    this.name = "CreationRejectedError";
    this.projectUnavailable = projectUnavailable;
  }
}
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): requestConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named requestConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): requestConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): requestConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): requestConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): requestConversation uses 30_000, 503, 400, 404 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): requestConversation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep requestConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep requestConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): requestConversation accepts operation: z.infer<typeof createConversationInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
