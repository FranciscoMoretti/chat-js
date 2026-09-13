import type { EveMessage } from "eve/client";

import type { EveForkInput } from "./contracts";

const importedBoundary = /^seed_message_(0|[1-9][0-9]{0,3})$/;
const nativeBoundary = /^turn_(0|[1-9][0-9]*)$/;

export function eveUserForkBoundary(
  message: Pick<EveMessage, "id" | "role" | "metadata">
) {
  if (message.role !== "user" || message.metadata?.optimistic) {
    return undefined;
  }
  if (
    message.metadata?.turnId &&
    nativeBoundary.test(message.metadata.turnId)
  ) {
    return message.metadata.turnId;
  }
  return importedBoundary.test(message.id) ? message.id : undefined;
}

export interface EveBranchReference {
  forkTurnId: string | null;
  id: string;
  parentConversationId: string | null;
}

/** Resolve native checkpoint ancestry while keeping imported seed boundaries local. */
export function resolveForkSource(
  conversationId: string,
  boundaryId: string,
  branches: readonly EveBranchReference[]
): EveForkInput {
  if (
    importedBoundary.test(boundaryId) &&
    branches.some((branch) => branch.id === conversationId)
  ) {
    // Each descendant owns its retained seed prefix and document checkpoints.
    return { conversationId, beforeMessageId: boundaryId };
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
      return { conversationId: current.id, beforeTurnId };
    }
    const parentId = current.parentConversationId;
    current = branches.find((branch) => branch.id === parentId);
  }
  throw new Error("The source version is unavailable. Reload before editing.");
}
