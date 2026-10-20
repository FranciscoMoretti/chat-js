/** The lifecycle fields used to prove that a positively bound operation has stopped. */
export interface WorkspaceTurnEvent {
  readonly type: string;
  readonly data?: {
    readonly turnId?: string;
    readonly sessionId?: string;
    readonly remote?: boolean;
  };
  readonly meta?: { readonly deliveryIds?: readonly string[] };
}

const terminalTurns = new Set([
  "turn.completed",
  "turn.failed",
  "turn.cancelled",
]);
const boundaries = new Set([
  "session.started",
  "session.completed",
  "session.failed",
  "session.waiting",
  "turn.started",
  "turn.waiting",
  "message.received",
  "step.started",
]);

/** A parked approval/task turn is not an idle session. */
export const hasSettledWorkspaceSession = (
  events: readonly WorkspaceTurnEvent[]
): boolean => {
  const boundary = events.findLast((event) => boundaries.has(event.type));
  return (
    boundary?.type === "session.waiting" ||
    boundary?.type === "session.completed" ||
    boundary?.type === "session.failed"
  );
};

/** Match the receipt before accepting a later terminal outcome, never an old idle event. */
export const hasSettledWorkspaceOperation = (
  operation: {
    readonly kind: "create" | "copy" | "send";
    readonly deliveryId: string | null;
    readonly seeded: boolean;
  },
  events: readonly WorkspaceTurnEvent[]
): boolean => {
  if (!hasSettledWorkspaceSession(events)) {
    return false;
  }
  if (operation.kind === "copy" || operation.seeded) {
    return true;
  }
  const received = events.findIndex(
    (event) =>
      event.type === "message.received" &&
      (operation.kind === "create" ||
        (operation.deliveryId !== null &&
          event.meta?.deliveryIds?.includes(operation.deliveryId) === true))
  );
  if (received === -1) {
    return false;
  }
  const turnId = events[received]?.data?.turnId;
  return (
    typeof turnId === "string" &&
    turnId !== "" &&
    events
      .slice(received + 1)
      .some(
        (event) =>
          terminalTurns.has(event.type) && event.data?.turnId === turnId
      )
  );
};
