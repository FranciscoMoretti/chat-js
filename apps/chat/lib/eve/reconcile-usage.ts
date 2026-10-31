import { reconcileEveSubagentUsage } from "./reconcile-subagent-usage";
import { requireEveDeletionLifecycle } from "./deletion-lifecycle";
import { retireEveSessionForDeletion } from "./retire-session";
import { Client } from "eve/client";
import { listEveSubagents } from "@/lib/db/eve-subagents";
import {
  advanceEveUsageCursor,
  getEveUsageCursor,
  withManagedUsageReconciliation,
} from "@/lib/db/eve-billing";
import type { SessionStreamEvent } from "eve/client";
import { assertEveConfigured } from "./server";
import { env } from "@/lib/env";
import { getEveConnectionOptions } from "./connection-options";
import { getEveStreamPositions } from "./stream-positions";
import { ingestEveActivity } from "./activity";
import { ingestEveUsage } from "./usage";
import { listEveOwnerBindings } from "@/lib/db/eve-queries";
import { recoverEveCreations } from "./recover-creations";
import { resolveWorkflowWorld } from "./world-config";
import { tryEveAccountingWrite } from "./accounting-log";

const INITIAL_STREAM_INDEX = 0;
const STREAM_READ_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT_USAGE_READS = 4;

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
  let latestActivity: SessionStreamEvent | undefined;
  for await (const event of session.stream({
    follow: false,
    signal: AbortSignal.timeout(STREAM_READ_TIMEOUT_MS),
    startIndex,
  })) {
    if (event.type === "delivery.consumed" || event.type === "turn.settled") {
      latestActivity = event;
    }
    const priced = await ingestEveUsage(ownerId, sessionId, event);
    if (!priced) {
      unresolved = true;
    }
  }
  ({ streamIndex } = session.state);
  if (!(await reconcileEveSubagentUsage(ownerId, sessionId, replayUnpriced))) {
    unresolved = true;
  }
  if (latestActivity) {
    await ingestEveActivity(
      ownerId,
      sessionId,
      latestActivity,
      new Date(latestActivity.meta.at)
    );
  }
  if (unresolved) {
    // Keep replay available for missing tool receipts without blocking admission.
    return;
  }
  if (streamIndex > startIndex) {
    await tryEveAccountingWrite({ ownerId, sessionId }, "cursor", async () => {
      await advanceEveUsageCursor(ownerId, sessionId, streamIndex);
    });
  }
};

const reconcileAllOwnerUsage = async (
  ownerId: string,
  unpricedSessions: Readonly<ReadonlySet<string>> = new Set<string>()
): Promise<void> => {
  const ownerBindings = await listEveOwnerBindings(ownerId);
  if (
    ownerBindings.some(
      (row) =>
        (row.state !== "bound" && row.state !== "deleting") ||
        typeof row.sessionId !== "string" ||
        row.sessionId === ""
    )
  ) {
    throw new Error(
      "Resolve uncertain session creation before starting more work."
    );
  }
  assertEveConfigured();
  const deletingSessions = new Set(
    ownerBindings.flatMap((row) =>
      row.state === "deleting" && typeof row.sessionId === "string"
        ? [row.sessionId]
        : []
    )
  );
  if (deletingSessions.size > 0) {
    // Reuse durable settlement receipts: partial cleanup may already have erased
    // native streams. Never skip deleting usage merely because access is revoked.
    await requireEveDeletionLifecycle().retire(
      [...deletingSessions],
      async (id) => {
        await retireEveSessionForDeletion(ownerId, id);
      }
    );
  }
  const bindings = ownerBindings.filter((row) => row.state === "bound");
  const ownerChildren = await listEveSubagents(ownerId);
  const children = ownerChildren.filter(
    (child) =>
      child.rootSessionId === null || !deletingSessions.has(child.rootSessionId)
  );
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
  await recoverEveCreations(ownerId);
  if (resolveWorkflowWorld(env) !== "vercel") {
    await reconcileAllOwnerUsage(ownerId);
    return;
  }
  // Hooks handle normal billing. Rate-limit the missed-hook fallback durably:
  // settled history must not be streamed on every message or new conversation.
  await withManagedUsageReconciliation(
    ownerId,
    async (sweepDue, unpricedSessions: Readonly<ReadonlySet<string>>) => {
      if (sweepDue) {
        // Retry missing tool receipts at the durable sweep interval.
        await reconcileAllOwnerUsage(ownerId, unpricedSessions);
      } else if (
        typeof sessionId === "string" &&
        sessionId !== "" &&
        !unpricedSessions.has(sessionId)
      ) {
        // Fresh tails remain eligible; unresolved history waits for the next sweep.
        await reconcileEveUsage(ownerId, sessionId);
      }
    }
  );
};

export { reconcileEveOwnerUsage, reconcileEveUsage };
