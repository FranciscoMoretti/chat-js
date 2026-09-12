import { z } from "zod";
import { eveRequest } from "./server";

/** Check before allocating a native child: a bound source may not have checkpointed yet. */
export async function waitForEveCheckpoint(
  ownerId: string,
  sessionId: string,
  beforeTurnId: string,
  checkpointId?: string
) {
  const deadline = Date.now() + 15_000;
  const path = `/eve/v1/session/${encodeURIComponent(sessionId)}/checkpoint${checkpointId ? `/${encodeURIComponent(checkpointId)}` : ""}?beforeTurnId=${encodeURIComponent(beforeTurnId)}`;
  do {
    const result = await eveRequest(ownerId, path, {
      signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
    });
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
      return;
    }
    if (
      result.status !== 404 ||
      !z.object({ code: z.literal("checkpoint_not_ready") }).safeParse(body)
        .success
    ) {
      throw new Error("Source checkpoint lookup is unavailable.");
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
