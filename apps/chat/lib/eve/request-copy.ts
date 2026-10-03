/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { z } from "zod";

import { conversationBinding } from "./contracts";
import { eveCopyInput } from "./copy-input";
import type { EveCopyInput } from "./copy-input";
/* oxlint-enable sort-imports */

const keyFor = (ownerId: string, sourceId: string): string =>
  `chatjs.eve.pending-copy:${ownerId}:${sourceId.toLowerCase()}`;

type CopyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/* oxlint-disable import/group-exports, import/no-named-export, max-params, no-ternary, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): preparePendingEveCopy stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named preparePendingEveCopy API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-params (#511): preparePendingEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-ternary (#518): preparePendingEveCopy derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/explicit-function-return-type (#560): Keep preparePendingEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep preparePendingEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): preparePendingEveCopy intentionally keeps the existing falsy-value behavior of saved; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const preparePendingEveCopy = (
  storage: CopyStorage,
  ownerId: string,
  sourceConversationId: string,
  modelId: string
) => {
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
/* oxlint-enable import/group-exports, import/no-named-export, max-params, no-ternary, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/strict-boolean-expressions --
 * import/group-exports (#523): finishPendingEveCopy stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named finishPendingEveCopy API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/strict-boolean-expressions (#610): finishPendingEveCopy intentionally keeps the existing falsy-value behavior of stored; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const finishPendingEveCopy = (
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
/* oxlint-enable import/group-exports, import/no-named-export, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): EveCopyRequestError stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EveCopyRequestError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export class EveCopyRequestError extends Error {
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
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null --
 * import/group-exports (#523): requestEveCopy stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named requestEveCopy API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-statements (#512): requestEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): requestEveCopy uses 45_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): requestEveCopy derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): requestEveCopy uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): requestEveCopy sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep requestEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep requestEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): requestEveCopy preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const requestEveCopy = async (input: EveCopyInput) => {
  const signal = AbortSignal.timeout(45_000);
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
        .safeParse(await response.json().catch(() => null));
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
/* oxlint-enable import/group-exports, import/no-named-export, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null */
