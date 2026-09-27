import { Client } from "eve/client";
import type { MessageStreamEvent } from "eve/client";

import {
  advanceEveUsageCursor,
  getEveUsageCursor,
  withManagedUsageReconciliation,
} from "../db/eve-billing";
import { listEveOwnerBindings } from "../db/eve-queries";
import { env } from "../env";
import { ingestEveActivity } from "./activity";
import { getEveConnectionOptions } from "./connection-options";
import { recoverEveCreations } from "./recover-creations";
import { assertEveConfigured } from "./server";
import { getEveStreamPositions } from "./stream-positions";
import { ingestEveUsage } from "./usage";
import { resolveWorkflowWorld } from "./world-config";

/** Repair missed hooks from the unread suffix of Eve's authoritative stream. */
export const reconcileEveUsage = async (
  ownerId: string,
  sessionId: string,
  replayUnpriced = false
) => {
  assertEveConfigured();
  const startIndex = replayUnpriced
    ? 0
    : await getEveUsageCursor(ownerId, sessionId);
  const client = new Client(getEveConnectionOptions(ownerId));
  const session = client.sessions.attach(sessionId);
  let streamIndex = startIndex;
  let unresolved = false;
  let latestActivity: MessageStreamEvent | undefined;
  for await (const event of session.stream({
    follow: false,
    signal: AbortSignal.timeout(15_000),
    startIndex,
  })) {
    streamIndex += 1;
    if (
      event.type === "message.received" ||
      event.type === "message.completed"
    ) {
      latestActivity = event;
    }
    const priced = await ingestEveUsage(ownerId, sessionId, event);
    if (
      (event.type === "step.completed" ||
        event.type === "compaction.usage" ||
        event.type === "hook.result" ||
        event.type === "action.result") &&
      priced === false
    ) {
      unresolved = true;
    }
  }
  if (latestActivity) {
    await ingestEveActivity(ownerId, sessionId, latestActivity);
  }
  if (unresolved) {
    throw new Error(
      "Completed usage needs provider cost reconciliation before starting more work."
    );
  }
  if (streamIndex > startIndex) {
    await advanceEveUsageCursor(ownerId, sessionId, streamIndex);
  }
};

const reconcileAllOwnerUsage = async (
  ownerId: string,
  unpricedSessions = new Set<string>()
) => {
  const bindings = await listEveOwnerBindings(ownerId);
  if (bindings.some((row) => row.state !== "bound" || !row.sessionId)) {
    throw new Error(
      "Resolve uncertain session creation before starting more work."
    );
  }
  assertEveConfigured();
  const positions = await getEveStreamPositions(
    bindings.flatMap((row) => (row.sessionId ? [row.sessionId] : []))
  );
  for (const row of bindings) {
    const length = row.sessionId ? positions.get(row.sessionId) : undefined;
    if (length !== undefined && length < row.usageStreamIndex) {
      throw new Error("Eve stream is shorter than its durable billing cursor.");
    }
  }
  // Compare exact durable positions, not activity timestamps or terminal events:
  // old deployments and parked tools may append usage after a completed turn.
  const pending = bindings
    .filter(
      (row) =>
        !row.sessionId ||
        unpricedSessions.has(row.sessionId) ||
        positions.get(row.sessionId) !== row.usageStreamIndex
    )
    .values();
  let failure:
    | {
        cause: unknown;
      }
    | undefined;
  // A slow stream occupies only its own slot. On failure, drain existing reads
  // before returning so a retry cannot overlap billing work left by this call.
  const worker = async () => {
    while (!failure) {
      const next = pending.next();
      if (next.done) {
        return;
      }
      try {
        if (next.value.sessionId) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Advance durable evidence in order without skipping unresolved work.
          await reconcileEveUsage(
            ownerId,
            next.value.sessionId,
            unpricedSessions.has(next.value.sessionId)
          );
        }
      } catch (error) {
        failure ??= { cause: error };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, bindings.length) }, worker)
  );
  if (failure) {
    throw failure.cause;
  }
};

export const reconcileEveOwnerUsage = async (
  ownerId: string,
  sessionId?: string
) => {
  await recoverEveCreations(ownerId);
  if (resolveWorkflowWorld(env) !== "vercel") {
    return await reconcileAllOwnerUsage(ownerId);
  }
  // Hooks handle normal billing. Rate-limit the missed-hook fallback durably:
  // settled history must not be streamed on every message or new conversation.
  await withManagedUsageReconciliation(
    ownerId,
    async (sweepDue, unpricedSessions) => {
      if (sweepDue || unpricedSessions.size > 0) {
        // Older cursors can have passed failed attempts before their explicit
        // zero-charge classification; replay that evidence rather than strand it.
        await reconcileAllOwnerUsage(ownerId, unpricedSessions);
      } else if (sessionId) {
        // The conversation receiving new work is never covered by the cooldown.
        await reconcileEveUsage(ownerId, sessionId);
      }
    }
  );
};
