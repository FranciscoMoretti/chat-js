import { z } from "zod";
import { Client, ClientError } from "eve/client";

import {
  bindGuestRuntimeCleanupSession,
  claimExpiredGuestRuntimeSession,
  completeGuestRuntimeDeletion,
  countPendingGuestRuntimeDeletions,
  pruneGuestRuntimeRates,
} from "@/chatjs/plugins/guest-chat/guest-queries";
import { getGuestCleanupConnectionOptions } from "@/chatjs/plugins/guest-chat/guest-cleanup-auth";

const MAX_CLEANUP_BATCH = 5;
const RETIRE_TIMEOUT_MS = 30_000;

const resolveCleanupSession = async (
  guest: {
    readonly id: string;
    readonly modelId: string;
    readonly ownerId: string;
    readonly sessionId: string | null;
  },
  signal: AbortSignal
): Promise<string> => {
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
  const response = await fetch(`${connection.baseUrl}/v1/session`, {
    method: "POST",
    redirect: "error",
    headers: {
      ...connection.headers,
      authorization: `Bearer ${connection.auth.bearer}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ operationId: guest.id }),
    signal,
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

export const cleanupGuestRuntimeSessions = async ({
  deadline = Number.POSITIVE_INFINITY,
}: { readonly deadline?: number } = {}): Promise<{
  deletedCount: number;
  retiredCount: number;
  pendingCount: number;
  skipped: boolean;
}> => {
  const initialPendingCount = await countPendingGuestRuntimeDeletions();
  if (initialPendingCount === 0) {
    await pruneGuestRuntimeRates();
    return {
      deletedCount: 0,
      retiredCount: 0,
      pendingCount: 0,
      skipped: false,
    };
  }
  let retiredCount = 0;
  let pendingCount = 0;
  for (
    let attempt = 0;
    attempt < MAX_CLEANUP_BATCH && Date.now() < deadline;
    attempt += 1
  ) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Claim and retire one session at a time to bound provider connections and work.
    const guest = await claimExpiredGuestRuntimeSession();
    if (!guest) {
      break;
    }
    let phase = "reconcile-session";
    try {
      const signal = AbortSignal.timeout(
        Math.max(1, Math.min(RETIRE_TIMEOUT_MS, deadline - Date.now()))
      );
      // oxlint-disable-next-line eslint/no-await-in-loop -- Reconcile only the current claimed guest before retirement.
      const sessionId = await resolveCleanupSession(guest, signal);
      phase = "retire";
      const retire = async (): Promise<void> => {
        const client = new Client(
          getGuestCleanupConnectionOptions({
            ownerId: guest.ownerId,
            modelId: guest.modelId,
            policyId: guest.id,
            sessionId,
          })
        );
        const session = client.sessions.attach(sessionId);
        const current = await session.snapshot({
          signal,
        });
        if (current.events.some((event) => event.type === "session.ended")) {
          return;
        }
        const retirement = await session.end({
          reason: "Guest retention expired",
          signal,
        });
        for await (const event of retirement.stream({
          signal,
        })) {
          if (event.type === "session.ended") {
            return;
          }
        }
        const snapshot = await session.snapshot({
          signal,
        });
        if (!snapshot.events.some((event) => event.type === "session.ended")) {
          throw new Error("Guest retirement is not terminal. Retry cleanup.");
        }
      };
      try {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Finish this session before completing its policy; payloads follow native World retention.
        await retire();
      } catch (error) {
        // EVE can expire history as soon as end completes. Only its explicit
        // expiry response is terminal evidence; 404, auth and transport failures retry.
        if (
          !ClientError.is(error) ||
          error.status !== 410 ||
          error.code !== "session_expired"
        ) {
          throw error;
        }
      }
      phase = "complete-policy";
      // oxlint-disable-next-line eslint/no-await-in-loop -- Complete local policy after verified ending or expiry.
      if (!(await completeGuestRuntimeDeletion(guest.id, sessionId))) {
        throw new Error("Guest deletion binding changed.");
      }
      retiredCount += 1;
    } catch {
      pendingCount += 1;
      console.error("Guest runtime cleanup requires retry", {
        policyId: guest.id,
        phase,
      });
    }
  }
  if (Date.now() >= deadline) {
    // No new bookkeeping after the deadline; a later sweep establishes completion.
    return {
      deletedCount: 0,
      retiredCount,
      pendingCount: Math.max(
        pendingCount,
        initialPendingCount - retiredCount,
        1
      ),
      skipped: false,
    };
  }
  await pruneGuestRuntimeRates();
  pendingCount = Math.max(
    pendingCount,
    await countPendingGuestRuntimeDeletions()
  );
  return { deletedCount: 0, retiredCount, pendingCount, skipped: false };
};
