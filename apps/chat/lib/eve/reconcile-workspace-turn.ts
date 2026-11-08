import { setTimeout as delay } from "node:timers/promises";
import { Client } from "eve/client";
import {
  readActiveEveWorkspaceOperation,
  releaseSettledEveWorkspaceOperation,
} from "../db/eve-workspace-turns";
import { getEveConnectionOptions } from "./connection-options";
import {
  hasSettledWorkspaceOperation,
  hasSettledWorkspaceSession,
} from "./workspace-turn-evidence";
import type { WorkspaceTurnEvent } from "./workspace-turn-evidence";
import { z } from "zod";

const seededCreation = z.object({ fork: z.looseObject({}) });

/** Wait only for known seed initialization; timeout never authorizes another dispatch. */
const readWorkspaceEvents = async (
  read: () => Promise<readonly WorkspaceTurnEvent[]>,
  signal: AbortSignal,
  waitForSeed: boolean
): Promise<readonly WorkspaceTurnEvent[]> => {
  let events = await read();
  if (waitForSeed) {
    while (!hasSettledWorkspaceSession(events)) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Observe initialization of this exact known seed; one deadline bounds all polls.
      await delay(250, undefined, { signal });
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each snapshot follows the previous observation of the same native seed.
      events = await read();
    }
  }
  return events;
};

const hasSettledDescendants = async (
  events: readonly WorkspaceTurnEvent[],
  sessionId: string,
  read: (nativeSessionId: string) => Promise<readonly WorkspaceTurnEvent[]>
): Promise<boolean> => {
  const visited = new Set([sessionId]);
  const pending = [...events];
  for (const event of pending) {
    const childId =
      event.type === "child.opened" ? event.data.sessionId : undefined;
    if (
      event.type !== "child.opened" ||
      event.data.stream !==
        `/eve/v1/session/${encodeURIComponent(event.data.sessionId)}/stream` ||
      childId === undefined ||
      childId === "" ||
      visited.has(childId)
    ) {
      continue;
    }
    visited.add(childId);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Descendant reads are bounded by one deadline and each child's settled state is required before releasing its root workspace reservation.
    const child = await read(childId);
    if (!hasSettledWorkspaceSession(child)) {
      return false;
    }
    pending.push(...child);
  }
  return true;
};

/** Reconcile known receipts only. Failure/absence leaves the durable workspace reservation intact. */
export const reconcileEveWorkspaceTurn = async (
  ownerId: string,
  conversationId: string,
  options: { readonly waitForSeed?: boolean } = {}
): Promise<void> => {
  const active = await readActiveEveWorkspaceOperation(ownerId, conversationId);
  const sessionId = active?.operation.sessionId;
  if (
    active === undefined ||
    sessionId === null ||
    sessionId === undefined ||
    sessionId === ""
  ) {
    return;
  }
  const { operation } = active;
  const connection = getEveConnectionOptions(ownerId);
  const client = new Client({
    ...connection,
    headers: {
      ...connection.headers,
      ...(active.deleting === "deleting" ? { "x-chatjs-deletion": "1" } : {}),
    },
  });
  const signal = AbortSignal.timeout(15_000);
  const seeded =
    operation.kind === "copy" ||
    (operation.kind === "create" &&
      seededCreation.safeParse(operation.intent).success);
  const read = async (
    nativeSessionId: string
  ): Promise<readonly WorkspaceTurnEvent[]> => {
    const snapshot = await client.sessions
      .attach(nativeSessionId)
      .snapshot({ signal });
    return snapshot.events;
  };
  let events: readonly WorkspaceTurnEvent[];
  try {
    events = await readWorkspaceEvents(
      async () => await read(sessionId),
      signal,
      options.waitForSeed === true &&
        operation.conversationId === conversationId &&
        seeded
    );
    if (
      !hasSettledWorkspaceOperation(
        {
          kind: operation.kind,
          deliveryId: operation.deliveryId,
          seeded,
        },
        events
      )
    ) {
      return;
    }
    if (!(await hasSettledDescendants(events, sessionId, read))) {
      return;
    }
  } catch {
    // A missing/unauthorized/unreadable native session is not proof of non-admission.
    return;
  }
  await releaseSettledEveWorkspaceOperation(
    ownerId,
    active.workspaceId,
    operation.operationId
  );
};
