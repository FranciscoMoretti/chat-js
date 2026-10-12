import { isNonEmptyString } from "@/lib/is-non-empty-string";

import type { EveMessage } from "eve/client";

import type { EveForkInput, EveForkKind } from "./contracts";
import type { ReadonlyEveMessageMetadata } from "./readonly-message-types";

const importedBoundary = /^seed_message_(?<messageIndex>0|[1-9][0-9]{0,3})$/u;
const nativeBoundary = /^turn_(?<turnIndex>0|[1-9][0-9]*)$/u;

const eveUserForkBoundary = (message: {
  readonly id: string;
  readonly role: EveMessage["role"];
  readonly metadata?: ReadonlyEveMessageMetadata;
}): string | undefined => {
  if (message.role !== "user" || message.metadata?.optimistic) {
    return undefined;
  }
  if (
    isNonEmptyString(message.metadata?.turnId) &&
    nativeBoundary.test(message.metadata.turnId)
  ) {
    return message.metadata.turnId;
  }
  if (importedBoundary.test(message.id)) {
    return message.id;
  }
  return undefined;
};

interface EveBranchReference {
  forkKind?: EveForkKind | null;
  forkMessageId?: string | null;
  forkTurnId: string | null;
  id: string;
  parentConversationId: string | null;
  responseGroupId?: string | null;
  responseGroupIndex?: number | null;
}

/** Resolve native checkpoint ancestry while keeping imported seed boundaries local.
 * @param {string} conversationId Conversation version from which the edit or fork starts.
 * @param {string} boundaryId Imported message or native turn checkpoint immediately before the fork.
 * @param {readonly Readonly<EveBranchReference>[]} branches Known ancestry used to find the conversation owning the native checkpoint.
 * @returns {EveForkInput} The source conversation and its local message or native turn boundary.
 */
const resolveForkSource = (
  conversationId: string,
  boundaryId: string,
  branches: readonly Readonly<EveBranchReference>[]
): EveForkInput => {
  if (
    importedBoundary.test(boundaryId) &&
    branches.some((branch) => branch.id === conversationId)
  ) {
    // Each descendant owns its retained seed prefix and document checkpoints.
    return { beforeMessageId: boundaryId, conversationId };
  }
  if (!nativeBoundary.test(boundaryId)) {
    throw new Error(
      "The source version is unavailable. Reload before editing."
    );
  }
  const beforeTurnId = boundaryId;
  const visited = new Set<string>();
  let current = branches.find((branch) => branch.id === conversationId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (
      !(
        isNonEmptyString(current.parentConversationId) &&
        isNonEmptyString(current.forkTurnId)
      ) ||
      BigInt(beforeTurnId.slice(5)) >= BigInt(current.forkTurnId.slice(5))
    ) {
      return { beforeTurnId, conversationId: current.id };
    }
    const parentId = current.parentConversationId;
    current = branches.find((branch) => branch.id === parentId);
  }
  throw new Error("The source version is unavailable. Reload before editing.");
};

export { eveUserForkBoundary, resolveForkSource };
export type { EveBranchReference };
