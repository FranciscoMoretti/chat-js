import { z } from "zod";
import { Client } from "eve/client";

import {
  bindGuestRuntimeCleanupSession,
  claimExpiredGuestRuntimeSession,
  completeGuestRuntimeDeletion,
  countPendingGuestRuntimeDeletions,
  pruneGuestRuntimeRates,
} from "@/lib/db/guest-runtime";
import { getGuestCleanupConnectionOptions } from "./guest-cleanup-auth";
import { requireEveDeletionLifecycle } from "./deletion-lifecycle";

const MAX_CLEANUP_BATCH = 5;
const RETIRE_TIMEOUT_MS = 30_000;

const resolveCleanupSession = async (guest: {
  readonly id: string;
  readonly modelId: string;
  readonly ownerId: string;
  readonly sessionId: string | null;
}): Promise<string> => {
  if (guest.sessionId !== null) {
    return guest.sessionId;
  }
  // Replay the original operation before deletion. EVE returns its existing
  // session or creates one empty session, which this sweep immediately retires.
  const connection = getGuestCleanupConnectionOptions({
    ownerId: guest.ownerId,
    modelId: guest.modelId,
    policyId: guest.id,
  });
  const response = await fetch(`${connection.host}/v1/session`, {
    method: "POST",
    redirect: "error",
    headers: {
      ...connection.headers,
      authorization: `Bearer ${connection.auth.bearer}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ operationId: guest.id }),
    signal: AbortSignal.timeout(RETIRE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error("Guest creation reconciliation remains unresolved.");
  }
  const { sessionId } = z
    .object({ sessionId: z.string().min(1) })
    .parse(await response.json());
  if (
    !(await bindGuestRuntimeCleanupSession(guest.id, guest.ownerId, sessionId))
  ) {
    throw new Error("Guest cleanup binding changed.");
  }
  return sessionId;
};

export const cleanupGuestRuntimeSessions = async (): Promise<{
  deletedCount: number;
  pendingCount: number;
  skipped: boolean;
}> => {
  if ((await countPendingGuestRuntimeDeletions()) === 0) {
    await pruneGuestRuntimeRates();
    return { deletedCount: 0, pendingCount: 0, skipped: false };
  }
  const lifecycle = requireEveDeletionLifecycle();
  // Compatibility checks precede claims or retirement. Missing fences never
  // produce a successful cleanup report or erase the durable retry record.
  await lifecycle.check();
  let deletedCount = 0;
  let pendingCount = 0;
  for (let attempt = 0; attempt < MAX_CLEANUP_BATCH; attempt += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Claim and purge one session at a time to bound provider connections and work.
    const guest = await claimExpiredGuestRuntimeSession();
    if (!guest) {
      break;
    }
    let phase = "reconcile-session";
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Reconcile only the current claimed guest before native purge.
      const sessionId = await resolveCleanupSession(guest);
      phase = "retire-and-purge";
      // oxlint-disable-next-line eslint/no-await-in-loop -- Native purge serializes durable retirement, fencing, queue drain and payload erasure.
      await lifecycle.purge(sessionId, async () => {
        const client = new Client(
          getGuestCleanupConnectionOptions({
            ownerId: guest.ownerId,
            modelId: guest.modelId,
            policyId: guest.id,
            sessionId,
          })
        );
        const session = client.sessions.attach(sessionId);
        await session.reset({
          reason: "Guest retention expired",
          signal: AbortSignal.timeout(RETIRE_TIMEOUT_MS),
        });
        const snapshot = await session.snapshot({
          signal: AbortSignal.timeout(RETIRE_TIMEOUT_MS),
        });
        if (
          !snapshot.events.some(
            (event) =>
              event.type === "session.completed" ||
              event.type === "session.failed"
          )
        ) {
          throw new Error("Guest retirement is not terminal. Retry cleanup.");
        }
      });
      phase = "complete-policy";
      // oxlint-disable-next-line eslint/no-await-in-loop -- Mark deleted only after the exact bound native session was purged.
      if (!(await completeGuestRuntimeDeletion(guest.id, sessionId))) {
        throw new Error("Guest deletion binding changed.");
      }
      deletedCount += 1;
    } catch {
      pendingCount += 1;
      console.error("Guest runtime cleanup requires retry", {
        policyId: guest.id,
        phase,
      });
    }
  }
  await pruneGuestRuntimeRates();
  pendingCount = Math.max(
    pendingCount,
    await countPendingGuestRuntimeDeletions()
  );
  return { deletedCount, pendingCount, skipped: false };
};
