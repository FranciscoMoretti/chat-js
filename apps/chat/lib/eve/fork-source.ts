import type { EveForkInput } from "./contracts";

export interface EveBranchReference {
  forkTurnId: string | null;
  id: string;
  parentConversationId: string | null;
}

/** Inherited turns belong to an ancestor; their checkpoint lives there. */
export function resolveForkSource(
  conversationId: string,
  beforeTurnId: string,
  branches: readonly EveBranchReference[]
): EveForkInput {
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
