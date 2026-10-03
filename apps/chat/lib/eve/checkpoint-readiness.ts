/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { z } from "zod";

import {
  CheckpointRejectedError,
  checkpointRejectionReason,
} from "./checkpoint-rejection";
import { eveRequest } from "./server";
/* oxlint-enable sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-params, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): readEveCheckpoint stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named readEveCheckpoint API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): readEveCheckpoint's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): readEveCheckpoint's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): readEveCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): readEveCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): readEveCheckpoint uses 15_000, 409, 404 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): readEveCheckpoint derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): readEveCheckpoint sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): readEveCheckpoint copies or separates ...(checkpointId ? { checkpointId: z.literal(checkpointId) } : {}) while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): readEveCheckpoint accepts signal: AbortSignal = AbortSignal.timeout(15_000); deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): readEveCheckpoint intentionally keeps the existing falsy-value behavior of checkpointId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** A missing checkpoint is pending; every other lookup failure stays unresolved. */
export const readEveCheckpoint = async (
  ownerId: string,
  sessionId: string,
  beforeTurnId: string,
  checkpointId?: string,
  signal: AbortSignal = AbortSignal.timeout(15_000)
): Promise<boolean> => {
  const path = `/eve/chat/v1/session/${encodeURIComponent(sessionId)}/checkpoint${checkpointId ? `/${encodeURIComponent(checkpointId)}` : ""}?beforeTurnId=${encodeURIComponent(beforeTurnId)}`;
  const result = await eveRequest(ownerId, path, { signal });
  const body: unknown = await result.json();
  if (result.ok) {
    const ready = z
      .object({
        beforeTurnId: z.literal(beforeTurnId),
        ...(checkpointId ? { checkpointId: z.literal(checkpointId) } : {}),
        ready: z.literal(true),
        sessionId: z.literal(sessionId),
      })
      .safeParse(body);
    if (!ready.success) {
      throw new Error("Invalid source checkpoint receipt.");
    }
    return true;
  }
  const rejection = z
    .object({
      checkpointRejected: z.literal(true),
      error: checkpointRejectionReason,
    })
    .safeParse(body);
  if (checkpointId && result.status === 409 && rejection.success) {
    throw new CheckpointRejectedError(rejection.data.error);
  }
  if (
    result.status === 404 &&
    z.object({ code: z.literal("checkpoint_not_ready") }).safeParse(body)
      .success
  ) {
    return false;
  }
  throw new Error("Source checkpoint lookup is unavailable.");
};
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-params, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, max-params, no-magic-numbers, oxc/no-async-await, unicorn/max-nested-calls --
 * import/group-exports (#523): waitForEveCheckpoint stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named waitForEveCheckpoint API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): waitForEveCheckpoint's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): waitForEveCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): waitForEveCheckpoint uses 15_000, 1, 250 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): waitForEveCheckpoint sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * unicorn/max-nested-calls (#568): waitForEveCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Check before allocating a native child: a bound source may not have checkpointed yet. */
export const waitForEveCheckpoint = async (
  ownerId: string,
  sessionId: string,
  beforeTurnId: string,
  checkpointId?: string
): Promise<void> => {
  const deadline = Date.now() + 15_000;
  do {
    if (
      // oxlint-disable-next-line eslint/no-await-in-loop -- Keep ordered reads and bounded cleanup sequential.
      await readEveCheckpoint(
        ownerId,
        sessionId,
        beforeTurnId,
        checkpointId,
        AbortSignal.timeout(Math.max(1, deadline - Date.now()))
      )
    ) {
      return;
    }
    if (Date.now() >= deadline) {
      break;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop, promise/avoid-new -- Retry only after the preceding attempt and delay have completed.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 250);
    });
  } while (Date.now() < deadline);
  throw new Error(
    "Source checkpoint is not ready. Retry the same operation shortly."
  );
};
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, max-params, no-magic-numbers, oxc/no-async-await, unicorn/max-nested-calls */
