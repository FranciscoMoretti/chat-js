import { Client } from "eve/client";
import {
  advanceEveSubagentUsageCursor,
  getEveSubagent,
  listEveSubagents,
} from "@/lib/db/eve-subagents";
import { getEveConnectionOptions } from "./connection-options";
import { getEveStreamPositions } from "./stream-positions";
import { ingestEveUsage } from "./usage";
import { tryEveAccountingWrite } from "./accounting-log";

const INITIAL_STREAM_INDEX = 0;
const STREAM_EVENT_INCREMENT = 1;
const STREAM_READ_TIMEOUT_MS = 15_000;

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
        event.type === "agent.started" &&
        !event.data.remote &&
        !discovered.has(event.data.sessionId)
      ) {
        const nested = await getEveSubagent(ownerId, event.data.sessionId);

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
      await tryEveAccountingWrite(
        { ownerId, sessionId: child.sessionId },
        "cursor",
        async () => {
          await advanceEveSubagentUsageCursor(
            ownerId,
            child.sessionId,
            childIndex
          );
        }
      );
    }
  }
  return !unresolved;
};

export { reconcileEveSubagentUsage };
