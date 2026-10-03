/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { MessageStreamEvent } from "eve/client";
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import type { UiToolName } from "../ai/types";
import { draftAttachment } from "./draft";
import { eveToolMetadata } from "./message-tool-selection";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export --
 * import/exports-last (#522): EVE_MESSAGE_OPERATION_HEADER is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): EVE_MESSAGE_OPERATION_HEADER stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EVE_MESSAGE_OPERATION_HEADER API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const EVE_MESSAGE_OPERATION_HEADER = "x-chatjs-message-operation";
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

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

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export --
 * import/exports-last (#522): PendingEveMessage is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): PendingEveMessage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named PendingEveMessage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type PendingEveMessage = z.infer<typeof pendingMessage>;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */
/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export --
 * import/exports-last (#522): ActivePendingEveMessage is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ActivePendingEveMessage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ActivePendingEveMessage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ActivePendingEveMessage = PendingEveMessage & {
  operationId: string;
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */
type NewPendingEveMessage = Omit<
  PendingEveMessage,
  "operationId" | "rejection"
>;
type DeliveryStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const storageKey = (sessionId: string): string =>
  `chatjs.eve.pending-message:${sessionId}`;

/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): write uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep write's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const write = <T extends PendingEveMessage>(
  storage: DeliveryStorage,
  sessionId: string,
  value: T
) => {
  storage.setItem(storageKey(sessionId), JSON.stringify(value));
  return value;
};
/* oxlint-enable id-length, typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type, typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep read's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): read intentionally keeps the existing falsy-value behavior of stored; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): read preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, import/no-named-export, max-params, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): eveMessageDelivery stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveMessageDelivery API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-params (#511): eveMessageDelivery keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): eveMessageDelivery uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-optional-chaining (#542): eveMessageDelivery handles optional deliveryMetadata.safeParse(event.data.metadata).data?.chatjs .operationId; stored?.operationId; current?.retryable without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): eveMessageDelivery copies or separates ...input; ...pending; ...current while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep eveMessageDelivery's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveMessageDelivery's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): eveMessageDelivery accepts pending: PendingEveMessage; event: MessageStreamEvent; input: NewPendingEveMessage; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): eveMessageDelivery intentionally keeps the existing falsy-value behavior of pending.operationId; current?.retryable; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** One durable client contract for sending, reloading, rejecting, and acknowledging a message. */
export const eveMessageDelivery = {
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
  ) => write(storage, sessionId, { ...pending, rejection, retryable }),
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
/* oxlint-enable import/group-exports, import/no-named-export, max-params, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): eveMessageDeliveryMetadata stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveMessageDeliveryMetadata API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): eveMessageDeliveryMetadata's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveMessageDeliveryMetadata's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-rest-spread-properties (#543): eveMessageDeliveryMetadata copies or separates ...eveToolMetadata(selectedTool).chatjs while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep eveMessageDeliveryMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveMessageDeliveryMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
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
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, import/no-named-export, no-ternary, no-undefined, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): eveMessageOperationId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveMessageOperationId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): eveMessageOperationId derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): eveMessageOperationId uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-optional-chaining (#542): eveMessageOperationId handles optional deliveryMetadata.safeParse(event.data.metadata).data?.chatjs.operationId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep eveMessageOperationId's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveMessageOperationId's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): eveMessageOperationId accepts event: MessageStreamEvent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const eveMessageOperationId = (event: MessageStreamEvent) =>
  event.type === "message.received"
    ? deliveryMetadata.safeParse(event.data.metadata).data?.chatjs.operationId
    : undefined;
/* oxlint-enable import/group-exports, import/no-named-export, no-ternary, no-undefined, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
