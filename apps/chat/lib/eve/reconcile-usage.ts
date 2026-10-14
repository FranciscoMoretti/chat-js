import {
  assertEveModelAccountingPrepared,
  assertEveModelCostsKnown,
} from "@/lib/db/eve-model-ledger";
import { Client } from "eve/client";
import {
  advanceEveSubagentUsageCursor,
  getEveSubagent,
  listEveSubagents,
} from "@/lib/db/eve-subagents";
import {
  advanceEveUsageCursor,
  getEveUsageCursor,
  withManagedUsageReconciliation,
} from "@/lib/db/eve-billing";
import type { MessageStreamEvent } from "eve/client";
import { assertEveConfigured } from "./server";
import { env } from "@/lib/env";
import { getEveConnectionOptions } from "./connection-options";
import { getEveStreamPositions } from "./stream-positions";
import { ingestEveActivity } from "./activity";
import { ingestEveUsage } from "./usage";
import { listEveOwnerBindings } from "@/lib/db/eve-queries";
import { recoverEveCreations } from "./recover-creations";
import { resolveWorkflowWorld } from "./world-config";

const INITIAL_STREAM_INDEX = 0;
const STREAM_EVENT_INCREMENT = 1;
const STREAM_READ_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT_USAGE_READS = 4;
const NO_UNPRICED_SESSIONS = 0;

/**
 * Settle native descendants before admission or erasing a root session.
 * @param {string} ownerId - Owner whose child sessions and billing cursors are reconciled.
 * @param {string} sessionId - Root session binding required for every discovered descendant.
 * @param {boolean} replayUnpriced - Replay from the beginning instead of each saved child cursor.
 * @returns {Promise<boolean>} Whether every visited child has resolved usage; unresolved children keep their cursors.
 */
const reconcileEveSubagentUsage = async (
  ownerId: string,
  sessionId: string,
  replayUnpriced = false
): Promise<boolean> => {
  const client = new Client(getEveConnectionOptions(ownerId));
  let unresolved = false;
  const descendants = await listEveSubagents(ownerId, sessionId);
  const discovered = new Set(descendants.map((child) => child.sessionId));
  const positions = await getEveStreamPositions(
    descendants.map((child) => child.sessionId)
  );
  for (const child of descendants) {
    const start = replayUnpriced
      ? INITIAL_STREAM_INDEX
      : child.usageStreamIndex;
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
    // oxlint-disable-next-line eslint/no-await-in-loop -- Discover and settle descendants before their durable cursor advances; each of four workers must finish its read and observe shared failure before scheduling another.
    for await (const event of client.sessions.attach(child.sessionId).stream({
      follow: false,
      signal: AbortSignal.timeout(STREAM_READ_TIMEOUT_MS),
      startIndex: start,
    })) {
      childIndex += STREAM_EVENT_INCREMENT;
      if (
        !(await ingestEveUsage(ownerId, child.sessionId, event, {
          sessionId,
          turnId: child.rootTurnId,
        }))
      ) {
        childUnresolved = true;
      }
      if (
        event.type === "subagent.called" &&
        !event.data.remote &&
        !discovered.has(event.data.childSessionId)
      ) {
        const nested = await getEveSubagent(ownerId, event.data.childSessionId);

        if (nested === null || nested.rootSessionId !== sessionId) {
          throw new Error("Delegated usage requires an owned root binding.");
        }
        discovered.add(nested.sessionId);
        descendants.push(nested);
      }
    }
    if (childUnresolved) {
      unresolved = true;
    } else if (childIndex > start) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Discover and settle descendants before their durable cursor advances; each of four workers must finish its read and observe shared failure before scheduling another.
      await advanceEveSubagentUsageCursor(ownerId, child.sessionId, childIndex);
    }
  }
  return !unresolved;
};

/**
 * Repair missed usage/activity hooks from Eve's authoritative stream.
 * @param {string} ownerId - Owner whose root and descendant usage will be ingested.
 * @param {string} sessionId - Root session whose cursor advances only after reconciliation succeeds.
 * @param {boolean} replayUnpriced - Replay the root and descendants from the beginning to retry pricing. */
const reconcileEveUsage = async (
  ownerId: string,
  sessionId: string,
  replayUnpriced = false
): Promise<void> => {
  assertEveConfigured();
  const startIndex = replayUnpriced
    ? INITIAL_STREAM_INDEX
    : await getEveUsageCursor(ownerId, sessionId);
  const client = new Client(getEveConnectionOptions(ownerId));
  const session = client.sessions.attach(sessionId);
  let streamIndex = startIndex;
  let unresolved = false;
  let latestActivity: MessageStreamEvent | undefined;
  for await (const event of session.stream({
    follow: false,
    signal: AbortSignal.timeout(STREAM_READ_TIMEOUT_MS),
    startIndex,
  })) {
    streamIndex += STREAM_EVENT_INCREMENT;
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
      !priced
    ) {
      unresolved = true;
    }
  }
  if (!(await reconcileEveSubagentUsage(ownerId, sessionId, replayUnpriced))) {
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
  unpricedSessions: Readonly<ReadonlySet<string>> = new Set<string>()
): Promise<void> => {
  const bindings = await listEveOwnerBindings(ownerId);
  if (
    bindings.some(
      (row) =>
        row.state !== "bound" ||
        typeof row.sessionId !== "string" ||
        row.sessionId === ""
    )
  ) {
    throw new Error(
      "Resolve uncertain session creation before starting more work."
    );
  }
  assertEveConfigured();
  const children = await listEveSubagents(ownerId);
  const positions = await getEveStreamPositions([
    ...bindings.flatMap((row) => {
      if (typeof row.sessionId === "string" && row.sessionId !== "") {
        return [row.sessionId];
      }
      return [];
    }),
    ...children.map((child) => child.sessionId),
  ]);
  for (const row of bindings) {
    const length =
      typeof row.sessionId === "string" && row.sessionId !== ""
        ? positions.get(row.sessionId)
        : undefined;
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
    if (typeof child.rootSessionId !== "string" || child.rootSessionId === "") {
      throw new Error("Native child has no owned root session.");
    }
    if (length !== child.usageStreamIndex) {
      rootsWithPendingChildren.add(child.rootSessionId);
    }
  }
  const pending = bindings
    .filter(
      (row) =>
        typeof row.sessionId !== "string" ||
        row.sessionId === "" ||
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
  const worker = async (): Promise<void> => {
    while (!failure) {
      const next = pending.next();
      if (next.done === true) {
        return;
      }
      try {
        if (
          typeof next.value.sessionId === "string" &&
          next.value.sessionId !== ""
        ) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Discover and settle descendants before their durable cursor advances; each of four workers must finish its read and observe shared failure before scheduling another.
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
    Array.from(
      { length: Math.min(MAX_CONCURRENT_USAGE_READS, bindings.length) },
      worker
    )
  );
  if (failure) {
    throw failure.cause;
  }
};

const reconcileEveOwnerUsage = async (
  ownerId: string,
  sessionId?: string
): Promise<void> => {
  await assertEveModelAccountingPrepared(ownerId);
  await recoverEveCreations(ownerId);
  if (resolveWorkflowWorld(env) !== "vercel") {
    await reconcileAllOwnerUsage(ownerId);
    await assertEveModelCostsKnown(ownerId);
    return;
  }
  // Hooks handle normal billing. Rate-limit the missed-hook fallback durably:
  // settled history must not be streamed on every message or new conversation.
  await withManagedUsageReconciliation(
    ownerId,
    async (sweepDue, unpricedSessions: Readonly<ReadonlySet<string>>) => {
      if (sweepDue || unpricedSessions.size > NO_UNPRICED_SESSIONS) {
        // Tool receipts may be missing despite a previous successful sweep.
        await reconcileAllOwnerUsage(ownerId, unpricedSessions);
      } else if (typeof sessionId === "string" && sessionId !== "") {
        // The conversation receiving new work is never covered by the cooldown.
        await reconcileEveUsage(ownerId, sessionId);
      }
    }
  );
  await assertEveModelCostsKnown(ownerId);
};

export { reconcileEveOwnerUsage, reconcileEveSubagentUsage, reconcileEveUsage };
