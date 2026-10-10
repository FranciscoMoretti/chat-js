import {
  CheckpointRejectedError,
  checkpointRejectionReason,
} from "./checkpoint-rejection";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { eveRequest } from "./server";
import { z } from "zod";

const CHECKPOINT_TIMEOUT_MS = 15_000;
const CHECKPOINT_POLL_INTERVAL_MS = 250;
const MINIMUM_REQUEST_TIMEOUT_MS = 1;
const HTTP_CONFLICT = 409;
const HTTP_NOT_FOUND = 404;

const validateReadyCheckpoint = (
  body: unknown,
  expected: Readonly<{
    beforeTurnId: string;
    checkpointId?: string;
    sessionId: string;
  }>
): void => {
  const ready = z
    .object({
      beforeTurnId: z.literal(expected.beforeTurnId),
      // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- The conditional shape omits unnamed checkpoints; pinned prefer-object-spread and prefer-ternary require this expression form.
      ...(typeof expected.checkpointId === "string" &&
      expected.checkpointId !== ""
        ? { checkpointId: z.literal(expected.checkpointId) }
        : {}),
      ready: z.literal(true),
      sessionId: z.literal(expected.sessionId),
    })
    .safeParse(body);
  if (!ready.success) {
    throw new Error("Invalid source checkpoint receipt.");
  }
};

const classifyCheckpointFailure = (
  result: Readonly<Pick<Response, "status">>,
  body: unknown,
  checkpointId?: string
): false => {
  const rejection = z
    .object({
      checkpointRejected: z.literal(true),
      error: checkpointRejectionReason,
    })
    .safeParse(body);
  if (
    typeof checkpointId === "string" &&
    checkpointId !== "" &&
    result.status === HTTP_CONFLICT &&
    rejection.success
  ) {
    throw new CheckpointRejectedError(rejection.data.error);
  }
  if (
    result.status === HTTP_NOT_FOUND &&
    z.object({ code: z.literal("checkpoint_not_ready") }).safeParse(body)
      .success
  ) {
    return false;
  }
  throw new Error("Source checkpoint lookup is unavailable.");
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEveCheckpoint's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-params -- The exported positional checkpoint API has existing callers outside this module; changing it requires an API migration. */
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
  signal: ReadonlyNativeSurface<AbortSignal> = AbortSignal.timeout(
    CHECKPOINT_TIMEOUT_MS
  )
): Promise<boolean> => {
  // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const path = `/eve/chat/v1/session/${encodeURIComponent(sessionId)}/checkpoint${typeof checkpointId === "string" && checkpointId !== "" ? `/${encodeURIComponent(checkpointId)}` : ""}?beforeTurnId=${encodeURIComponent(beforeTurnId)}`;
  const result = await eveRequest(ownerId, path, { signal });
  const body: unknown = await result.json();
  if (result.ok) {
    validateReadyCheckpoint(body, { beforeTurnId, checkpointId, sessionId });
    return true;
  }
  return classifyCheckpointFailure(result, body, checkpointId);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve waitForEveCheckpoint's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params */

/* oxlint-disable max-params -- The exported positional checkpoint-wait API has existing callers outside this module; changing it requires an API migration. */
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
  const deadline = Date.now() + CHECKPOINT_TIMEOUT_MS;
  do {
    const signal = AbortSignal.timeout(
      Math.max(MINIMUM_REQUEST_TIMEOUT_MS, deadline - Date.now())
    );
    if (
      // oxlint-disable-next-line eslint/no-await-in-loop -- Keep ordered reads and bounded cleanup sequential.
      await readEveCheckpoint(
        ownerId,
        sessionId,
        beforeTurnId,
        checkpointId,
        signal
      )
    ) {
      return;
    }
    if (Date.now() >= deadline) {
      break;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop, promise/avoid-new -- Retry only after the preceding attempt and delay have completed.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, CHECKPOINT_POLL_INTERVAL_MS);
    });
  } while (Date.now() < deadline);
  throw new Error(
    "Source checkpoint is not ready. Retry the same operation shortly."
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (readEveCheckpoint, waitForEveCheckpoint); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-params */
export { readEveCheckpoint, waitForEveCheckpoint };
/* oxlint-enable import/no-named-export */
