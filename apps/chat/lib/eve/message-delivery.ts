import type { MessageStreamEvent } from "eve/client";
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import type { UiToolName } from "../ai/types";
import { draftAttachment } from "./draft";
import { eveToolMetadata } from "./message-tool-selection";

export const EVE_MESSAGE_OPERATION_HEADER = "x-chatjs-message-operation";

const pendingMessage = z.object({
  attachments: z.array(draftAttachment).default([]),
  message: z.string(),
  modelId: z.string().optional(),
  operationId: z.uuid().optional(),
  rejection: z.string().optional(),
  selectedTool: frontendToolsSchema.optional(),
});

const deliveryMetadata = z.object({
  chatjs: z.object({ operationId: z.uuid() }),
});

export type PendingEveMessage = z.infer<typeof pendingMessage>;
export type ActivePendingEveMessage = PendingEveMessage & {
  operationId: string;
};
type NewPendingEveMessage = Omit<
  PendingEveMessage,
  "operationId" | "rejection"
>;
type DeliveryStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const storageKey = (sessionId: string) =>
  `chatjs.eve.pending-message:${sessionId}`;

const write = <T extends PendingEveMessage>(
  storage: DeliveryStorage,
  sessionId: string,
  value: T
) => {
  storage.setItem(storageKey(sessionId), JSON.stringify(value));
  return value;
};

const read = (storage: DeliveryStorage, sessionId: string) => {
  const stored = storage.getItem(storageKey(sessionId));
  if (!stored) {
    return null;
  }
  try {
    const parsed = pendingMessage.safeParse(JSON.parse(stored));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Invalid tab state cannot be recovered safely.
  }
  storage.removeItem(storageKey(sessionId));
  return null;
};

/** One durable client contract for sending, reloading, rejecting, and acknowledging a message. */
export const eveMessageDelivery = {
  acknowledge: (
    storage: DeliveryStorage,
    sessionId: string,
    pending: PendingEveMessage,
    event: MessageStreamEvent
  ) => {
    if (
      event.type !== "message.received" ||
      !pending.operationId ||
      deliveryMetadata.safeParse(event.data.metadata).data?.chatjs
        .operationId !== pending.operationId
    ) {
      return false;
    }
    const stored = read(storage, sessionId);
    if (stored?.operationId === pending.operationId) {
      storage.removeItem(storageKey(sessionId));
    }
    return true;
  },
  begin: (
    storage: DeliveryStorage,
    sessionId: string,
    input: NewPendingEveMessage
  ): ActivePendingEveMessage =>
    write(storage, sessionId, {
      ...input,
      operationId: crypto.randomUUID(),
    }),
  clear: (
    storage: DeliveryStorage,
    sessionId: string,
    operationId: string | undefined
  ) => {
    const stored = read(storage, sessionId);
    if (stored && stored.operationId === operationId) {
      storage.removeItem(storageKey(sessionId));
    }
  },
  read,
  reject: (
    storage: DeliveryStorage,
    sessionId: string,
    pending: PendingEveMessage,
    rejection: string
  ) => write(storage, sessionId, { ...pending, rejection }),
};

/** The proxy owns this metadata so caller input cannot forge an acknowledgement. */
export const eveMessageDeliveryMetadata = (
  operationId: string,
  selectedTool: UiToolName | null | undefined
) => ({
  chatjs: {
    ...eveToolMetadata(selectedTool).chatjs,
    operationId: z.uuid().parse(operationId),
  },
});

export const eveMessageOperationId = (event: MessageStreamEvent) =>
  event.type === "message.received"
    ? deliveryMetadata.safeParse(event.data.metadata).data?.chatjs.operationId
    : undefined;
