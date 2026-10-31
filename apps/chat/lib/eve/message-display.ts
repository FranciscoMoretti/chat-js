import type { ConversationState, SessionStreamEvent } from "eve/client";
import type { UiToolName } from "@/lib/ai/types";
import { eveToolMetadata } from "./message-tool-selection";

export interface EveMessageDisplayReceipt {
  readonly selectedTool: UiToolName | null;
  readonly kind: "send";
  readonly deliveryId: string;
}

/** Only directly returned delivery IDs authorize a selected-tool badge. */
export const projectEveMessageDisplay = <
  Data extends Pick<ConversationState, "messages">,
>(
  data: Data,
  events: readonly SessionStreamEvent[],
  receipts: readonly EveMessageDisplayReceipt[]
): Data => {
  const byDelivery = new Map<string, EveMessageDisplayReceipt[]>();
  for (const receipt of receipts) {
    byDelivery.set(receipt.deliveryId, [
      ...(byDelivery.get(receipt.deliveryId) ?? []),
      receipt,
    ]);
  }
  const consumed = new Map<string, number>();
  for (const event of events) {
    if (event.type !== "delivery.consumed") {
      continue;
    }
    consumed.set(
      event.data.deliveryId,
      (consumed.get(event.data.deliveryId) ?? 0) + 1
    );
  }
  const byMessage = new Map<string, EveMessageDisplayReceipt>();
  for (const [deliveryId, matches] of byDelivery) {
    if (matches.length === 1 && consumed.get(deliveryId) === 1) {
      byMessage.set(`${deliveryId}:user`, matches[0]);
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
