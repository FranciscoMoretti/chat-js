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
  conversationId: string
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
    events = await read(sessionId);
    if (
      !hasSettledWorkspaceOperation(
        {
          deliveryId: operation.deliveryId,
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
