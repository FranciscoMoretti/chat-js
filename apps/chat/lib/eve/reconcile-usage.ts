/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "eve/client" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
/* oxlint-disable eslint/no-await-in-loop -- Settle evidence and advance durable cursors in stream order. */
import { Client } from "eve/client";
import type { MessageStreamEvent } from "eve/client";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  advanceEveUsageCursor,
  getEveUsageCursor,
  withManagedUsageReconciliation,
} from "@/lib/db/eve-billing";
/* oxlint-enable sort-imports */
import { listEveOwnerBindings } from "@/lib/db/eve-queries";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  advanceEveSubagentUsageCursor,
  getEveSubagent,
  listEveSubagents,
} from "@/lib/db/eve-subagents";
/* oxlint-enable sort-imports */
import { env } from "@/lib/env";

import { ingestEveActivity } from "./activity";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveConnectionOptions } from "./connection-options";
/* oxlint-enable sort-imports */
import { recoverEveCreations } from "./recover-creations";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveConfigured } from "./server";
/* oxlint-enable sort-imports */
import { getEveStreamPositions } from "./stream-positions";
import { ingestEveUsage } from "./usage";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reconcileEveSubagentUsage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/max-dependencies */

/* oxlint-disable max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
max-lines-per-function (#510): reconcileEveSubagentUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): reconcileEveSubagentUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-continue (#515): reconcileEveSubagentUsage skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
no-magic-numbers (#517): reconcileEveSubagentUsage uses 0, 15_000, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): reconcileEveSubagentUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): reconcileEveSubagentUsage intentionally keeps the existing falsy-value behavior of nested; distinguishing empty, zero, and absent states requires a domain behavior decision. */
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
    // oxlint-disable-next-line no-ternary -- Keep start as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reconcileEveUsage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers -- moving it below executable initialization can obscure ordering and API ownership.
init-declarations (#507): reconcileEveUsage assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
max-lines-per-function (#510): reconcileEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): reconcileEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): reconcileEveUsage uses 0, 15_000, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
/**
 * Repair missed usage/activity hooks from Eve's authoritative stream.
 * @param {string} ownerId - Owner whose root and descendant usage will be ingested.
 * @param {string} sessionId - Root session whose cursor advances only after reconciliation succeeds.
 * @param {boolean} replayUnpriced - Replay the root and descendants from the beginning to retry pricing.
 */
const reconcileEveUsage = async (
  ownerId: string,
  sessionId: string,
  replayUnpriced = false
): Promise<void> => {
  assertEveConfigured();
  // oxlint-disable-next-line no-ternary -- Keep startIndex as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reconcileAllOwnerUsage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions -- * init-declarations (#507): reconcileAllOwnerUsage assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): reconcileAllOwnerUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reconcileAllOwnerUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): reconcileAllOwnerUsage uses 4 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): reconcileAllOwnerUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-boolean-expressions (#610): reconcileAllOwnerUsage intentionally keeps the existing falsy-value behavior of row.sessionId; child.rootSessionId; next.done; next.value.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const reconcileAllOwnerUsage = async (
  ownerId: string,
  unpricedSessions: Readonly<ReadonlySet<string>> = new Set<string>()
): Promise<void> => {
  const bindings = await listEveOwnerBindings(ownerId);
  if (bindings.some((row) => row.state !== "bound" || !row.sessionId)) {
    throw new Error(
      "Resolve uncertain session creation before starting more work."
    );
  }
  assertEveConfigured();
  const children = await listEveSubagents(ownerId);
  const positions = await getEveStreamPositions([
    ...bindings.flatMap((row) => {
      if (row.sessionId) {
        return [row.sessionId];
      }
      return [];
    }),
    ...children.map((child) => child.sessionId),
  ]);
  for (const row of bindings) {
    // oxlint-disable-next-line no-ternary -- Keep length as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  const worker = async (): Promise<void> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reconcileEveOwnerUsage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, typescript/strict-boolean-expressions -- no-magic-numbers (#517): reconcileEveOwnerUsage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/strict-boolean-expressions (#610): reconcileEveOwnerUsage intentionally keeps the existing falsy-value behavior of sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (reconcileEveOwnerUsage, reconcileEveSubagentUsage, reconcileEveUsage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/strict-boolean-expressions */
export { reconcileEveOwnerUsage, reconcileEveSubagentUsage, reconcileEveUsage };
/* oxlint-enable import/no-named-export */
