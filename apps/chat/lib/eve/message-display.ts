import type { ConversationState, SessionStreamEvent } from "eve/client";
import type { ReadonlyEveMessage } from "./readonly-message-types";
import type { UiToolName } from "@/lib/ai/types";
import { eveToolMetadata } from "./message-tool-selection";

export interface EveMessageDisplayReceipt {
  readonly selectedTool: UiToolName | null;
  readonly kind: "send";
  readonly deliveryId: string;
  readonly history?: readonly {
    readonly role: "user" | "assistant";
    readonly selectedTool?: UiToolName | null;
    readonly modelId?: string;
  }[];
}

/** Only directly returned delivery IDs authorize a selected-tool badge. */
export const projectEveMessageDisplay = <
  Data extends Pick<ConversationState, "messages">,
>(
  data: Data,
  events: readonly SessionStreamEvent[],
  receipts: readonly EveMessageDisplayReceipt[]
): Omit<Data, "messages"> & { messages: readonly ReadonlyEveMessage[] } => {
  const byDelivery = new Map<string, EveMessageDisplayReceipt[]>();
  for (const receipt of receipts) {
    const matches = byDelivery.get(receipt.deliveryId);
    if (matches) {
      matches.push(receipt);
    } else {
      byDelivery.set(receipt.deliveryId, [receipt]);
    }
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
  const inherited = new Map<
    string,
    NonNullable<EveMessageDisplayReceipt["history"]>[number]
  >();
  const byMessage = new Map<string, EveMessageDisplayReceipt>();
  for (const [deliveryId, matches] of byDelivery) {
    if (matches.length === 1 && consumed.get(deliveryId) === 1) {
      byMessage.set(`${deliveryId}:user`, matches[0]);
      for (const [index, display] of (matches[0].history ?? []).entries()) {
        inherited.set(`${deliveryId}:imported:${index}`, display);
      }
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
      const display = message.metadata?.imported
        ? inherited.get(message.id)
        : undefined;
      if (display?.role === message.role) {
        return {
          ...message,
          metadata: {
            ...message.metadata,
            ...(display.modelId === undefined
              ? {}
              : { modelId: display.modelId }),
            ...(display.selectedTool === undefined
              ? {}
              : { custom: eveToolMetadata(display.selectedTool) }),
          },
        };
      }
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
