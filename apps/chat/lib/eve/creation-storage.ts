import type { ChatCreationScope } from "@/chatjs/core/chat/contracts";
import { isNonEmptyString } from "@/lib/is-non-empty-string";
import type { StorageAccess } from "./creation-contract";
import { z } from "zod";

export type CreationScope =
  | { branchId: string; context?: never }
  | { context: ChatCreationScope; branchId?: never };

export const creationKey = (
  ownerId: string,
  scope?: Readonly<CreationScope>
): string => {
  let suffix = "";

  if (scope && isNonEmptyString(scope.branchId)) {
    suffix = `:fork:${scope.branchId}`;
  } else if (scope?.context) {
    suffix = `:${scope.context.key}`;
  }
  return `chatjs.eve.pending:${ownerId}${suffix}`;
};

const savedIdentity = z.object({ operationId: z.uuid() });
export const finishCurrentCreation = (
  storage: StorageAccess,
  ownerId: string,
  operationId: string,
  scope?: Readonly<CreationScope>
): void => {
  const key = creationKey(ownerId, scope);
  const stored = storage.getItem(key);
  if (
    isNonEmptyString(stored) &&
    savedIdentity.parse(JSON.parse(stored)).operationId.toLowerCase() ===
      operationId.toLowerCase()
  ) {
    storage.removeItem(key);
  }
};
