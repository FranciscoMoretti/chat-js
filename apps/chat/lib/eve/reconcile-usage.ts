/* oxlint-disable eslint/no-await-in-loop -- Settle evidence and advance durable cursors in stream order. */
import { Client } from "eve/client";
import type { MessageStreamEvent } from "eve/client";

import {
  advanceEveUsageCursor,
  getEveUsageCursor,
  withManagedUsageReconciliation,
} from "../db/eve-billing";
import { listEveOwnerBindings } from "../db/eve-queries";
import {
  advanceEveSubagentUsageCursor,
  getEveSubagent,
  listEveSubagents,
} from "../db/eve-subagents";
import { env } from "../env";
import { ingestEveActivity } from "./activity";
import { getEveConnectionOptions } from "./connection-options";
import { recoverEveCreations } from "./recover-creations";
import { assertEveConfigured } from "./server";
import { getEveStreamPositions } from "./stream-positions";
import { ingestEveUsage } from "./usage";
import { resolveWorkflowWorld } from "./world-config";

/** Settle native descendants before admission or erasing a root session. */
export const reconcileEveSubagentUsage = async (
  ownerId: string,
  sessionId: string,
  replayUnpriced = false
) => {
  const client = new Client(getEveConnectionOptions(ownerId));
  let unresolved = false;
  const descendants = await listEveSubagents(ownerId, sessionId);
  const discovered = new Set(descendants.map((child) => child.sessionId));
  const positions = await getEveStreamPositions(
    descendants.map((child) => child.sessionId)
  );
  for (const child of descendants) {
    const start = replayUnpriced ? 0 : child.usageStreamIndex;
    const length = positions.get(child.sessionId);
    if (length !== undefined && length < child.usageStreamIndex) {
      throw new Error(
        "Eve child stream is shorter than its durable billing cursor."
      );
    }
    if (!replayUnpriced && length === start) {
      continue;
    }
    let childIndex = start;
    let childUnresolved = false;
    for await (const event of client.sessions.attach(child.sessionId).stream({
      follow: false,
      signal: AbortSignal.timeout(15_000),
      startIndex: start,
    })) {
      childIndex += 1;
      if (
        (await ingestEveUsage(ownerId, child.sessionId, event, {
          sessionId,
          turnId: child.rootTurnId,
        })) === false
      ) {
        childUnresolved = true;
      }
      if (
        event.type === "subagent.called" &&
        !event.data.remote &&
        !discovered.has(event.data.childSessionId)
      ) {
        const nested = await getEveSubagent(ownerId, event.data.childSessionId);
        if (!nested || nested.rootSessionId !== sessionId) {
          throw new Error("Delegated usage requires an owned root binding.");
        }
        discovered.add(nested.sessionId);
        descendants.push(nested);
      }
    }
    if (childUnresolved) {
      unresolved = true;
    } else if (childIndex > start) {
      await advanceEveSubagentUsageCursor(ownerId, child.sessionId, childIndex);
    }
  }
  return !unresolved;
};

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
  if (
    (await reconcileEveSubagentUsage(ownerId, sessionId, replayUnpriced)) ===
    false
  ) {
    unresolved = true;
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
  const children = await listEveSubagents(ownerId);
  const positions = await getEveStreamPositions([
    ...bindings.flatMap((row) => (row.sessionId ? [row.sessionId] : [])),
    ...children.map((child) => child.sessionId),
  ]);
  for (const row of bindings) {
    const length = row.sessionId ? positions.get(row.sessionId) : undefined;
    if (length !== undefined && length < row.usageStreamIndex) {
      throw new Error("Eve stream is shorter than its durable billing cursor.");
    }
  }
  // Compare exact durable positions, not activity timestamps or terminal events:
  // old deployments and parked tools may append usage after a completed turn.
  const rootsWithPendingChildren = new Set<string>();
  for (const child of children) {
    const length = positions.get(child.sessionId);
    if (length !== undefined && length < child.usageStreamIndex) {
      throw new Error(
        "Eve child stream is shorter than its durable billing cursor."
      );
    }
    if (!child.rootSessionId) {
      throw new Error("Native child has no owned root session.");
    }
    if (length !== child.usageStreamIndex) {
      rootsWithPendingChildren.add(child.rootSessionId);
    }
  }
  const pending = bindings
    .filter(
      (row) =>
        !row.sessionId ||
        unpricedSessions.has(row.sessionId) ||
        rootsWithPendingChildren.has(row.sessionId) ||
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
