import { isNonEmptyString } from "@/lib/is-non-empty-string";
import { Client } from "eve/client";
import { getEveConnectionOptions } from "./connection-options";
import {
  prepareEveCopyTranscript,
  EveCopyNotReadyError,
} from "./copy-transcript";
import type { EveMessageDisplayReceipt } from "./message-display";

/** Caller holds the source admission and document locks through capture. */
export const readCompletedEveCopyTranscript = async (
  ownerId: string,
  sessionId: string,
  dispatches: readonly {
    readonly kind: string;
    readonly sessionId: string | null;
    readonly deliveryId: string | null;
  }[],
  receipts: readonly EveMessageDisplayReceipt[]
): Promise<ReturnType<typeof prepareEveCopyTranscript>> => {
  if (
    dispatches.some(
      (entry) =>
        !isNonEmptyString(entry.sessionId) ||
        (entry.kind === "send" && !isNonEmptyString(entry.deliveryId))
    )
  ) {
    throw new EveCopyNotReadyError();
  }
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const observed = new Set(
    snapshot.events.flatMap((event) =>
      event.type === "message.received" ? (event.meta.deliveryIds ?? []) : []
    )
  );
  if (
    dispatches.some(
      (entry) => entry.kind === "send" && !observed.has(entry.deliveryId ?? "")
    )
  ) {
    throw new EveCopyNotReadyError();
  }
  return prepareEveCopyTranscript(snapshot.events, receipts);
};
