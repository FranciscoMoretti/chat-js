import { isNonEmptyString } from "@/lib/is-non-empty-string";

import type { EveForkKind } from "./contracts";

interface EveResponseGroupLineageConversation {
  createdAt: Date;
  forkKind: EveForkKind | null;
  forkMessageId: string | null;
  forkTurnId: string | null;
  id: string;
  operationId: string;
  parentConversationId: string | null;
  sessionId: string;
}

type LineageConversation = Readonly<
  Omit<EveResponseGroupLineageConversation, "createdAt">
> & { readonly createdAt: Readonly<Date> };

interface EveResponseGroupLineage {
  groupId: string;
  replacements: ReadonlyMap<
    string,
    { conversationId: string; sessionId: string }
  >;
}

const localTurnBoundary = (
  conversation: LineageConversation
): string | null => {
  const { parentConversationId } = conversation;
  if (parentConversationId === null || parentConversationId === "") {
    return "turn_0";
  }
  const { forkMessageId } = conversation;
  if (forkMessageId !== null && forkMessageId !== "") {
    return "turn_0";
  }
  return conversation.forkTurnId;
};

const laterConversation = (
  left: LineageConversation,
  right: LineageConversation
): boolean => {
  if (left.createdAt.getTime() === right.createdAt.getTime()) {
    return left.id.localeCompare(right.id) > 0;
  }
  return left.createdAt > right.createdAt;
};

const latestRegeneration = (
  original: LineageConversation,
  originalBoundary: string,
  children: ReadonlyMap<string, readonly LineageConversation[]>,
  selectedConversationId: string,
  conversationsById: ReadonlyMap<string, LineageConversation>
): LineageConversation | undefined => {
  let latest = original;
  const valid = new Set([original.id]);
  const queue = [original];
  for (const ancestor of queue) {
    for (const child of children.get(ancestor.id) ?? []) {
      if (
        valid.has(child.id) ||
        child.forkKind !== "regenerate" ||
        child.forkMessageId !== null ||
        child.forkTurnId !== originalBoundary
      ) {
        continue;
      }
      valid.add(child.id);
      queue.push(child);
      if (laterConversation(child, latest)) {
        latest = child;
      }
    }
  }
  return valid.has(selectedConversationId)
    ? conversationsById.get(selectedConversationId)
    : latest;
};

const lineageReplacements = (
  selectedConversationId: string,
  conversations: readonly LineageConversation[],
  candidateOperationIds: readonly string[],
  conversationsById: ReadonlyMap<string, LineageConversation>
): Map<string, { conversationId: string; sessionId: string }> => {
  const children = new Map<string, LineageConversation[]>();
  for (const conversation of conversations) {
    if (!isNonEmptyString(conversation.parentConversationId)) {
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
  for (const operationId of candidateOperationIds) {
    const original = conversations.find(
      (conversation) => conversation.operationId === operationId
    );
    const originalBoundary = original ? localTurnBoundary(original) : null;
    if (!(original && isNonEmptyString(originalBoundary))) {
      continue;
    }
    const replacement = latestRegeneration(
      original,
      originalBoundary,
      children,
      selectedConversationId,
      conversationsById
    );
    if (replacement) {
      replacements.set(operationId, {
        conversationId: replacement.id,
        sessionId: replacement.sessionId,
      });
    }
  }
  return replacements;
};

/**
 * Resolve comparison ownership without treating edits or later turns as cards.
 * @param {string} selectedConversationId Selected conversation whose ancestry determines comparison ownership.
 * @param {readonly LineageConversation[]} conversations Family ancestry and retry conversations available to validate regeneration lineage.
 * @param {readonly { readonly candidateOperationIds: readonly string[]; readonly id: string; }[]} groups Comparison groups with their original candidate operation identities.
 * @returns {EveResponseGroupLineage | undefined} The owning group and valid latest retry replacements, or absence for missing, cyclic, or inapplicable lineage.
 */
const resolveEveResponseGroupLineage = (
  selectedConversationId: string,
  conversations: readonly LineageConversation[],
  groups: readonly {
    readonly candidateOperationIds: readonly string[];
    readonly id: string;
  }[]
): EveResponseGroupLineage | undefined => {
  const conversationsById = new Map(
    conversations.map((conversation) => [conversation.id, conversation])
  );
  const reversedLineage: LineageConversation[] = [];
  const visited = new Set<string>();
  let current = conversationsById.get(selectedConversationId);
  while (current && !visited.has(current.id)) {
    reversedLineage.push(current);
    visited.add(current.id);
    current = isNonEmptyString(current.parentConversationId)
      ? conversationsById.get(current.parentConversationId)
      : undefined;
  }
  if (reversedLineage.length === 0 || current) {
    return undefined;
  }
  const lineage = reversedLineage.toReversed();
  const candidateLocation = lineage.findLastIndex((conversation) =>
    groups.some((group) =>
      group.candidateOperationIds.includes(conversation.operationId)
    )
  );
  const candidate = lineage[candidateLocation];
  if (!(candidate !== undefined)) {
    return undefined;
  }
  const group = groups.find((entry) =>
    entry.candidateOperationIds.includes(candidate.operationId)
  );
  const boundary = localTurnBoundary(candidate);
  if (!(group && isNonEmptyString(boundary))) {
    return undefined;
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
    return undefined;
  }

  const replacements = lineageReplacements(
    selectedConversationId,
    conversations,
    group.candidateOperationIds,
    conversationsById
  );
  return { groupId: group.id, replacements };
};

export { resolveEveResponseGroupLineage };
export type { EveResponseGroupLineage, EveResponseGroupLineageConversation };
