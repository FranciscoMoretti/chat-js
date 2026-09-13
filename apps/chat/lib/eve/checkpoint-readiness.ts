import { z } from "zod";

import {
  CheckpointRejected,
  checkpointRejectionReason,
} from "./checkpoint-rejection";
import { eveRequest } from "./server";

/** A missing checkpoint is pending; every other lookup failure stays unresolved. */
export async function readEveCheckpoint(
  ownerId: string,
  sessionId: string,
  beforeTurnId: string,
  checkpointId?: string,
  signal: AbortSignal = AbortSignal.timeout(15_000)
) {
  const path = `/eve/v1/session/${encodeURIComponent(sessionId)}/checkpoint${checkpointId ? `/${encodeURIComponent(checkpointId)}` : ""}?beforeTurnId=${encodeURIComponent(beforeTurnId)}`;
  const result = await eveRequest(ownerId, path, { signal });
  const body: unknown = await result.json();
  if (result.ok) {
    const ready = z
      .object({
        ready: z.literal(true),
        ...(checkpointId ? { checkpointId: z.literal(checkpointId) } : {}),
        sessionId: z.literal(sessionId),
        beforeTurnId: z.literal(beforeTurnId),
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
    throw new CheckpointRejected(rejection.data.error);
  }
  if (
    result.status === 404 &&
    z.object({ code: z.literal("checkpoint_not_ready") }).safeParse(body)
      .success
  ) {
    return false;
  }
  throw new Error("Source checkpoint lookup is unavailable.");
}

/** Check before allocating a native child: a bound source may not have checkpointed yet. */
export async function waitForEveCheckpoint(
  ownerId: string,
  sessionId: string,
  beforeTurnId: string,
  checkpointId?: string
) {
  const deadline = Date.now() + 15_000;
  do {
    if (
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
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  throw new Error(
    "Source checkpoint is not ready. Retry the same operation shortly."
  );
}
