import type { MessageStreamEvent } from "eve/client";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { frontendToolsSchema } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */

import { draftAttachment } from "./draft";
import { eveToolMetadata } from "./message-tool-selection";

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

const deliveryMetadata = z.object({
  chatjs: z.object({ operationId: z.uuid() }),
});

type PendingEveMessage = z.infer<typeof pendingMessage>;

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

/* oxlint-disable id-length --
 * id-length (#506): write uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
const write = <T extends PendingEveMessage>(
  storage: DeliveryStorage,
  sessionId: string,
  value: T
): T => {
  storage.setItem(storageKey(sessionId), JSON.stringify(value));
  return value;
};
/* oxlint-enable id-length */

/* oxlint-disable typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/strict-boolean-expressions (#610): read intentionally keeps the existing falsy-value behavior of stored; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): read preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const read = (
  storage: DeliveryStorage,
  sessionId: string
): PendingEveMessage | null => {
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
/* oxlint-enable typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-params, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- max-params (#511): eveMessageDelivery keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): eveMessageDelivery uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/prefer-readonly-parameter-types (#565): eveMessageDelivery accepts pending: PendingEveMessage; event: MessageStreamEvent; input: NewPendingEveMessage; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): eveMessageDelivery intentionally keeps the existing falsy-value behavior of pending.operationId; current?.retryable; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** One durable client contract for sending, reloading, rejecting, and acknowledging a message. */
const eveMessageDelivery = {
  acknowledge: (
    storage: DeliveryStorage,
    sessionId: string,
    pending: PendingEveMessage,
    event: MessageStreamEvent
  ): boolean => {
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
    pending: PendingEveMessage,
    rejection: string,
    retryable = false
  ): PendingEveMessage & { rejection: string; retryable: boolean } =>
    write(storage, sessionId, { ...pending, rejection, retryable }),
  retry: (
    storage: DeliveryStorage,
    sessionId: string,
    pending: PendingEveMessage
  ): ActivePendingEveMessage | undefined => {
    const current = read(storage, sessionId);
    if (
      !pending.operationId ||
      !current?.retryable ||
      current.operationId !== pending.operationId
    ) {
      return;
    }
    // oxlint-disable-next-line typescript/consistent-return -- #580: eveMessageDelivery has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return write(storage, sessionId, {
      ...current,
      operationId: pending.operationId,
      rejection: undefined,
      retryable: undefined,
    });
  },
};
/* oxlint-enable max-params, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

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

/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types -- no-undefined (#519): eveMessageOperationId uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/prefer-readonly-parameter-types (#565): eveMessageOperationId accepts event: MessageStreamEvent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const eveMessageOperationId = (
  event: MessageStreamEvent
): string | undefined =>
  event.type === "message.received"
    ? deliveryMetadata.safeParse(event.data.metadata).data?.chatjs.operationId
    : undefined;
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EVE_MESSAGE_OPERATION_HEADER, eveMessageDelivery, eveMessageDeliveryMetadata, eveMessageOperationId); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types */
export {
  EVE_MESSAGE_OPERATION_HEADER,
  eveMessageDelivery,
  eveMessageDeliveryMetadata,
  eveMessageOperationId,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ActivePendingEveMessage, PendingEveMessage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ActivePendingEveMessage, PendingEveMessage };
/* oxlint-enable import/no-named-export */
