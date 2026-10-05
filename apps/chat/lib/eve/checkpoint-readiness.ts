import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  CheckpointRejectedError,
  checkpointRejectionReason,
} from "./checkpoint-rejection";
/* oxlint-enable sort-imports */
import { eveRequest } from "./server";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEveCheckpoint's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- max-params (#511): readEveCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): readEveCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): readEveCheckpoint uses 15_000, 409, 404 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): readEveCheckpoint accepts signal: AbortSignal = AbortSignal.timeout(15_000); deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): readEveCheckpoint intentionally keeps the existing falsy-value behavior of checkpointId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * A missing checkpoint is pending; every other lookup failure stays unresolved.
 * @param {string} ownerId Authenticated owner sent to the native checkpoint endpoint.
 * @param {string} sessionId Source session whose checkpoint receipt must match.
 * @param {string} beforeTurnId Turn boundary that must appear in the receipt.
 * @param {string | undefined} checkpointId Optional named checkpoint whose rejection raises CheckpointRejectedError.
 * @param {AbortSignal} signal Request cancellation, defaulting to a fifteen-second timeout.
 * @returns {Promise<boolean>} True for a validated ready receipt and false only for checkpoint_not_ready; other responses throw.
 */
const readEveCheckpoint = async (
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (checkpointId ? { checkpointId: z.literal(checkpointId) } : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve waitForEveCheckpoint's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-params, no-magic-numbers, unicorn/max-nested-calls -- max-params (#511): waitForEveCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): waitForEveCheckpoint uses 15_000, 1, 250 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
unicorn/max-nested-calls (#568): waitForEveCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
/**
 * Check before allocating a native child: a bound source may not have checkpointed yet.
 * @param {string} ownerId Authenticated owner of the source session.
 * @param {string} sessionId Source session that must finish checkpointing.
 * @param {string} beforeTurnId Required native turn boundary.
 * @param {string | undefined} checkpointId Optional named checkpoint to await.
 * @returns {Promise<void>} Completion after a validated ready receipt; unresolved checkpoints throw after the bounded wait.
 */
const waitForEveCheckpoint = async (
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (readEveCheckpoint, waitForEveCheckpoint); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-params, no-magic-numbers, unicorn/max-nested-calls */
export { readEveCheckpoint, waitForEveCheckpoint };
/* oxlint-enable import/no-named-export */
