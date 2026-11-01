import type { EveMessageData, MessageStreamEvent } from "eve/client";
import type { UiToolName } from "@/lib/ai/types";
import { eveToolMetadata } from "./message-tool-selection";

export type EveMessageDisplayReceipt = {
  readonly selectedTool: UiToolName | null;
} & (
  | { readonly kind: "initial" }
  | { readonly kind: "send"; readonly deliveryId: string }
);

const countMessageDeliveries = (
  events: readonly MessageStreamEvent[]
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.type === "message.received") {
      for (const deliveryId of event.meta.deliveryIds ?? []) {
        counts.set(deliveryId, (counts.get(deliveryId) ?? 0) + 1);
      }
    }
  }
  return counts;
};

/** Decorates only current-session user events with an exact known delivery binding. */
export const projectEveMessageDisplay = (
  data: EveMessageData,
  events: readonly MessageStreamEvent[],
  receipts: readonly EveMessageDisplayReceipt[]
): EveMessageData => {
  const byDelivery = new Map<string, EveMessageDisplayReceipt[]>();
  const add = (deliveryId: string, receipt: EveMessageDisplayReceipt): void => {
    const matching = byDelivery.get(deliveryId) ?? [];
    matching.push(receipt);
    byDelivery.set(deliveryId, matching);
  };
  const starts = events.filter((event) => event.type === "session.started");
  for (const receipt of receipts) {
    if (receipt.kind === "send") {
      add(receipt.deliveryId, receipt);
    } else if (
      starts.length === 1 &&
      starts[0].meta.deliveryIds?.length === 1
    ) {
      // Native initial emission carries ChannelDeliveryKey. Never inspect restored
      // history or guess the initial user from message order, turn number or text.
      add(starts[0].meta.deliveryIds[0], receipt);
    }
  }
  const byMessage = new Map<string, EveMessageDisplayReceipt>();
  const receivedCounts = countMessageDeliveries(events);
  for (const event of events) {
    if (
      event.type !== "message.received" ||
      !event.meta?.id ||
      event.meta.deliveryIds?.length !== 1
    ) {
      continue;
    }
    const matches = (event.meta?.deliveryIds ?? []).flatMap((deliveryId) => {
      if (receivedCounts.get(deliveryId) !== 1) {
        return [];
      }
      const receipt = byDelivery.get(deliveryId);
      return receipt ?? [];
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
