import { isNonEmptyString } from "@/lib/is-non-empty-string";

import type { MessageStreamEvent } from "eve/client";
import { z } from "zod";

import { frontendToolsSchema } from "@/lib/ai/types";
import type { UiToolName } from "@/lib/ai/types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { draftAttachment } from "./draft";
import { eveToolMetadata } from "./message-tool-selection";

type DeliveryEvent =
  | {
      readonly type: "message.received";
      readonly data: { readonly metadata?: unknown };
    }
  | { readonly type: Exclude<MessageStreamEvent["type"], "message.received"> };

const EVE_MESSAGE_OPERATION_HEADER = "x-chatjs-message-operation";

const pendingMessage = z.object({
  attachments: z.array(draftAttachment).default([]),
  message: z.string(),
  modelId: z.string().optional(),
  operationId: z.uuid().optional(),
  rejection: z.string().optional(),
  retryable: z.boolean().optional(),
  selectedTool: frontendToolsSchema.optional(),
});

const deliveryOperationIds = z.array(z.uuid()).optional();
const projectedDeliveryMetadata = z.object({
  chatjs: z.object({
    operationIds: deliveryOperationIds,
    sessionId: z.string(),
  }),
});

const deliveryMetadata = z.object({
  chatjs: z.object({ operationId: z.uuid() }),
});

const receiptMatches = (
  metadata: unknown,
  sessionId: string,
  operationId: string
): boolean => {
  const projected = projectedDeliveryMetadata.safeParse(metadata);
  if (projected.success) {
    if (projected.data.chatjs.sessionId !== sessionId) {
      return false;
    }
    if (projected.data.chatjs.operationIds !== undefined) {
      return projected.data.chatjs.operationIds.includes(operationId);
    }
  }
  return (
    deliveryMetadata.safeParse(metadata).data?.chatjs.operationId ===
    operationId
  );
};

type PendingEveMessage = ReadonlyNativeSurface<z.infer<typeof pendingMessage>>;

type ActivePendingEveMessage = PendingEveMessage & {
  operationId: string;
};

type NewPendingEveMessage = Omit<
  PendingEveMessage,
  "operationId" | "rejection"
>;
type DeliveryStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const storageKey = (sessionId: string): string =>
  `chatjs.eve.pending-message:${sessionId}`;

const write = <T extends PendingEveMessage>(
  storage: DeliveryStorage,
  sessionId: string,
  value: T
): T => {
  storage.setItem(storageKey(sessionId), JSON.stringify(value));
  return value;
};

const read = (
  storage: DeliveryStorage,
  sessionId: string
): PendingEveMessage | null => {
  const stored = storage.getItem(storageKey(sessionId));
  if (!isNonEmptyString(stored)) {
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
const eveMessageDelivery = {
  acknowledge: (
    storage: DeliveryStorage,
    sessionId: string,
    pending: ReadonlyNativeSurface<PendingEveMessage>,
    event: DeliveryEvent
  ): boolean => {
    if (
      event.type !== "message.received" ||
      !isNonEmptyString(pending.operationId) ||
      !receiptMatches(event.data.metadata, sessionId, pending.operationId)
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
    input: ReadonlyNativeSurface<NewPendingEveMessage>
  ): ActivePendingEveMessage =>
    write(storage, sessionId, {
      ...input,
      operationId: crypto.randomUUID(),
    }),
  clear: (
    storage: DeliveryStorage,
    sessionId: string,
    operationId: string | undefined
  ): void => {
    const stored = read(storage, sessionId);
    if (stored && stored.operationId === operationId) {
      storage.removeItem(storageKey(sessionId));
    }
  },
  read,
  reject: (
    storage: DeliveryStorage,
    sessionId: string,
    pending: ReadonlyNativeSurface<PendingEveMessage>,
    rejection: string,
    retryable = false
  ): PendingEveMessage & { rejection: string; retryable: boolean } =>
    write(storage, sessionId, { ...pending, rejection, retryable }),
  retry: (
    storage: DeliveryStorage,
    sessionId: string,
    pending: ReadonlyNativeSurface<PendingEveMessage>
  ): ActivePendingEveMessage | undefined => {
    const current = read(storage, sessionId);
    if (
      !isNonEmptyString(pending.operationId) ||
      !(current?.retryable === true) ||
      current.operationId !== pending.operationId
    ) {
      return undefined;
    }
    return write(storage, sessionId, {
      ...current,
      operationId: pending.operationId,
      rejection: undefined,
      retryable: undefined,
    });
  },
};

/**
 * The proxy owns this metadata so caller input cannot forge an acknowledgement.
 * @param {string} operationId Proxy-owned delivery operation UUID, validated before it enters message metadata.
 * @param {UiToolName | null | undefined} selectedTool App UI tool selection, normalized to null when no tool is selected.
 * @returns {{ chatjs: ReturnType<typeof eveToolMetadata>["chatjs"] & { operationId: string; }; }} The app namespace containing the operation acknowledgement and display-safe tool selection.
 */
const eveMessageDeliveryMetadata = (
  operationId: string,
  selectedTool: UiToolName | null | undefined
): {
  chatjs: ReturnType<typeof eveToolMetadata>["chatjs"] & {
    operationId: string;
  };
} => ({
  chatjs: {
    ...eveToolMetadata(selectedTool).chatjs,
    operationId: z.uuid().parse(operationId),
  },
});

export {
  EVE_MESSAGE_OPERATION_HEADER,
  eveMessageDelivery,
  eveMessageDeliveryMetadata,
};
export type { ActivePendingEveMessage, PendingEveMessage };
