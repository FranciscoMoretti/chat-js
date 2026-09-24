import type { EveMessage } from "eve/client";

import type { EveForkInput, EveForkKind } from "./contracts";

const importedBoundary = /^seed_message_(?<messageIndex>0|[1-9][0-9]{0,3})$/u;
const nativeBoundary = /^turn_(?<turnIndex>0|[1-9][0-9]*)$/u;

export const eveUserForkBoundary = (
  message: Pick<EveMessage, "id" | "role" | "metadata">
) => {
  if (message.role !== "user" || message.metadata?.optimistic) {
    return;
  }
  if (
    message.metadata?.turnId &&
    nativeBoundary.test(message.metadata.turnId)
  ) {
    return message.metadata.turnId;
  }
  return importedBoundary.test(message.id) ? message.id : undefined;
};

export interface EveBranchReference {
  forkKind?: EveForkKind | null;
  forkMessageId?: string | null;
  forkTurnId: string | null;
  id: string;
  parentConversationId: string | null;
  responseGroupId?: string | null;
  responseGroupIndex?: number | null;
}

/** Resolve native checkpoint ancestry while keeping imported seed boundaries local. */
export const resolveForkSource = (
  conversationId: string,
  boundaryId: string,
  branches: readonly EveBranchReference[]
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
      !(current.parentConversationId && current.forkTurnId) ||
      BigInt(beforeTurnId.slice(5)) >= BigInt(current.forkTurnId.slice(5))
    ) {
      return { beforeTurnId, conversationId: current.id };
    }
    const parentId = current.parentConversationId;
    current = branches.find((branch) => branch.id === parentId);
  }
  throw new Error("The source version is unavailable. Reload before editing.");
};
