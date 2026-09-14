import type { EveForkKind } from "./contracts";

export interface EveResponseGroupLineageConversation {
  createdAt: Date;
  forkKind: EveForkKind | null;
  forkMessageId: string | null;
  forkTurnId: string | null;
  id: string;
  operationId: string;
  parentConversationId: string | null;
  sessionId: string;
}

export interface EveResponseGroupLineage {
  groupId: string;
  replacements: ReadonlyMap<
    string,
    { conversationId: string; sessionId: string }
  >;
}

const localTurnBoundary = (
  conversation: EveResponseGroupLineageConversation
) => {
  if (!conversation.parentConversationId || conversation.forkMessageId) {
    return "turn_0";
  }
  return conversation.forkTurnId;
};

const laterConversation = (
  left: EveResponseGroupLineageConversation,
  right: EveResponseGroupLineageConversation
) =>
  left.createdAt.getTime() === right.createdAt.getTime()
    ? left.id.localeCompare(right.id) > 0
    : left.createdAt > right.createdAt;

/** Resolve comparison ownership without treating edits or later turns as cards. */
// oxlint-disable-next-line eslint/complexity -- Candidate discovery, lineage validation, and retry selection form one fail-closed projection.
export const resolveEveResponseGroupLineage = (
  selectedConversationId: string,
  conversations: readonly EveResponseGroupLineageConversation[],
  groups: readonly { candidateOperationIds: readonly string[]; id: string }[]
): EveResponseGroupLineage | undefined => {
  const conversationsById = new Map(
    conversations.map((conversation) => [conversation.id, conversation])
  );
  const reversedLineage: EveResponseGroupLineageConversation[] = [];
  const visited = new Set<string>();
  let current = conversationsById.get(selectedConversationId);
  while (current && !visited.has(current.id)) {
    reversedLineage.push(current);
    visited.add(current.id);
    current = current.parentConversationId
      ? conversationsById.get(current.parentConversationId)
      : undefined;
  }
  if (!reversedLineage.length || current) {
    return;
  }
  const lineage = reversedLineage.toReversed();
  const candidateLocation = lineage.findLastIndex((conversation) =>
    groups.some((group) =>
      group.candidateOperationIds.includes(conversation.operationId)
    )
  );
  const candidate = lineage[candidateLocation];
  if (!candidate) {
    return;
  }
  const group = groups.find((entry) =>
    entry.candidateOperationIds.includes(candidate.operationId)
  );
  const boundary = localTurnBoundary(candidate);
  if (!(group && boundary)) {
    return;
  }
  const selectedSuffix = lineage.slice(candidateLocation + 1);
  if (
    selectedSuffix.some(
      (conversation) =>
        conversation.forkKind !== "regenerate" ||
        conversation.forkTurnId !== boundary ||
        conversation.forkMessageId !== null
    )
  ) {
    return;
  }

  const children = new Map<string, EveResponseGroupLineageConversation[]>();
  for (const conversation of conversations) {
    if (!conversation.parentConversationId) {
      continue;
    }
    const existing = children.get(conversation.parentConversationId);
    if (existing) {
      existing.push(conversation);
    } else {
      children.set(conversation.parentConversationId, [conversation]);
    }
  }
  const replacements = new Map<
    string,
    { conversationId: string; sessionId: string }
  >();
  for (const operationId of group.candidateOperationIds) {
    const original = conversations.find(
      (conversation) => conversation.operationId === operationId
    );
    const originalBoundary = original ? localTurnBoundary(original) : null;
    if (!(original && originalBoundary)) {
      continue;
    }
    let latest = original;
    const valid = new Set([original.id]);
    const queue = [original];
    for (const ancestor of queue) {
      for (const child of children.get(ancestor.id) ?? []) {
        if (
          !valid.has(child.id) &&
          child.forkKind === "regenerate" &&
          child.forkMessageId === null &&
          child.forkTurnId === originalBoundary
        ) {
          valid.add(child.id);
          queue.push(child);
          if (laterConversation(child, latest)) {
            latest = child;
          }
        }
      }
    }
    const replacement = valid.has(selectedConversationId)
      ? conversationsById.get(selectedConversationId)
      : latest;
    if (replacement) {
      replacements.set(operationId, {
        conversationId: replacement.id,
        sessionId: replacement.sessionId,
      });
    }
  }
  return { groupId: group.id, replacements };
};
