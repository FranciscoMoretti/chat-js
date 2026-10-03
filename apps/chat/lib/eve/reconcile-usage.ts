/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports  --
 * import/max-dependencies (#524): import from "eve/client" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-billing"; "../db/eve-queries"; "../db/eve-subagents"; "../env" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
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
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions  --
 * import/exports-last (#522): reconcileEveSubagentUsage is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): reconcileEveSubagentUsage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named reconcileEveSubagentUsage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): reconcileEveSubagentUsage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): reconcileEveSubagentUsage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): reconcileEveSubagentUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reconcileEveSubagentUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): reconcileEveSubagentUsage skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): reconcileEveSubagentUsage uses 0, 15_000, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): reconcileEveSubagentUsage derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): reconcileEveSubagentUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): reconcileEveSubagentUsage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/strict-boolean-expressions (#610): reconcileEveSubagentUsage intentionally keeps the existing falsy-value behavior of nested; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Settle native descendants before admission or erasing a root session. */
export const reconcileEveSubagentUsage = async (
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
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, init-declarations, jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers  --
 * import/exports-last (#522): reconcileEveUsage is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): reconcileEveUsage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named reconcileEveUsage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * init-declarations (#507): reconcileEveUsage assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * jsdoc/require-param (#534): reconcileEveUsage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): reconcileEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reconcileEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): reconcileEveUsage uses 0, 15_000, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): reconcileEveUsage derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): reconcileEveUsage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
/** Repair missed hooks from the unread suffix of Eve's authoritative stream. */
export const reconcileEveUsage = async (
  ownerId: string,
  sessionId: string,
  replayUnpriced = false
): Promise<void> => {
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
/* oxlint-enable import/exports-last, import/group-exports, init-declarations, jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * init-declarations (#507): reconcileAllOwnerUsage assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): reconcileAllOwnerUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reconcileAllOwnerUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): reconcileAllOwnerUsage uses 4 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): reconcileAllOwnerUsage derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): reconcileAllOwnerUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): reconcileAllOwnerUsage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): reconcileAllOwnerUsage accepts unpricedSessions = new Set<string>(); deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reconcileAllOwnerUsage intentionally keeps the existing falsy-value behavior of row.sessionId; child.rootSessionId; next.done; next.value.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const reconcileAllOwnerUsage = async (
  ownerId: string,
  unpricedSessions = new Set<string>()
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
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): reconcileEveOwnerUsage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named reconcileEveOwnerUsage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): reconcileEveOwnerUsage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): reconcileEveOwnerUsage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): reconcileEveOwnerUsage accepts unpricedSessions; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reconcileEveOwnerUsage intentionally keeps the existing falsy-value behavior of sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const reconcileEveOwnerUsage = async (
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
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
