import { z } from "zod";

import {
  CheckpointRejectedError,
  checkpointRejectionReason,
} from "./checkpoint-rejection";
import { eveRequest } from "./server";

/** A missing checkpoint is pending; every other lookup failure stays unresolved. */
export const readEveCheckpoint = async (
  ownerId: string,
  sessionId: string,
  beforeTurnId: string,
  checkpointId?: string,
  signal: AbortSignal = AbortSignal.timeout(15_000)
) => {
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

/** Check before allocating a native child: a bound source may not have checkpointed yet. */
export const waitForEveCheckpoint = async (
  ownerId: string,
  sessionId: string,
  beforeTurnId: string,
  checkpointId?: string
) => {
  const deadline = Date.now() + 15_000;
  do {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Retry only after the preceding attempt and delay have completed.
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
