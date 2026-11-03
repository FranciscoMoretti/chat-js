import type { SessionStreamEvent } from "eve/client";

/** Correlate results with the native call identity instead of an output's contents. */
export const nativeToolEvents = <Type extends "call.settled" | "call.progress">(
  events: readonly SessionStreamEvent[],
  name: string,
  type: Type
): Extract<SessionStreamEvent, { type: Type }>[] => {
  const ids = new Set(
    events.flatMap((event) =>
      event.type === "call.requested" &&
      event.data.capability.kind === "tool" &&
      event.data.capability.name === name
        ? [event.data.callId]
        : []
    )
  );
  return events.filter(
    (event): event is Extract<SessionStreamEvent, { type: Type }> =>
      event.type === type &&
      "callId" in event.data &&
      ids.has(event.data.callId)
  );
};
