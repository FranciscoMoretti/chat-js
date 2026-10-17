import type { EveMessageData, MessageStreamEvent } from "eve/client";
import type { UiToolName } from "@/lib/ai/types";
import { eveToolMetadata } from "./message-tool-selection";

export interface EveMessageDisplayReceipt {
  readonly deliveryId: string;
  readonly selectedTool: UiToolName | null;
}

/** Decorates only current-session user events with an exact known delivery binding. */
export const projectEveMessageDisplay = (
  data: EveMessageData,
  events: readonly MessageStreamEvent[],
  receipts: readonly EveMessageDisplayReceipt[]
): EveMessageData => {
  const byDelivery = new Map(
    receipts.map((receipt) => [receipt.deliveryId, receipt])
  );
  const byMessage = new Map<string, EveMessageDisplayReceipt>();
  for (const event of events) {
    if (event.type !== "message.received" || !event.meta?.id) {
      continue;
    }
    const matches = (event.meta?.deliveryIds ?? []).flatMap((deliveryId) => {
      const receipt = byDelivery.get(deliveryId);
      return receipt ? [receipt] : [];
    });
    if (matches.length === 1) {
      byMessage.set(`${event.meta.id}:user`, matches[0]);
    }
  }
  if (byMessage.size === 0) {
    return data;
  }
  return {
    ...data,
    messages: data.messages.map((message) => {
      const receipt =
        message.role === "user" && !message.metadata?.optimistic
          ? byMessage.get(message.id)
          : undefined;
      return receipt
        ? {
            ...message,
            metadata: {
              ...message.metadata,
              custom: eveToolMetadata(receipt.selectedTool),
            },
          }
        : message;
    }),
  };
};
