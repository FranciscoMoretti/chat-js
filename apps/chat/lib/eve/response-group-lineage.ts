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

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): laterConversation uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const laterConversation = (
  left: LineageConversation,
  right: LineageConversation
): boolean => {
  if (left.createdAt.getTime() === right.createdAt.getTime()) {
    return left.id.localeCompare(right.id) > 0;
  }
  return left.createdAt > right.createdAt;
};
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-lines-per-function (#510): resolveEveResponseGroupLineage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): resolveEveResponseGroupLineage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): resolveEveResponseGroupLineage skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): resolveEveResponseGroupLineage uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): resolveEveResponseGroupLineage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-boolean-expressions (#610): resolveEveResponseGroupLineage intentionally keeps the existing falsy-value behavior of current.parentConversationId; candidate; boundary; conversation.parentConversationId; originalBoundary; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): resolveEveResponseGroupLineage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Resolve comparison ownership without treating edits or later turns as cards.
 * @param {string} selectedConversationId Selected conversation whose ancestry determines comparison ownership.
 * @param {readonly LineageConversation[]} conversations Family ancestry and retry conversations available to validate regeneration lineage.
 * @param {readonly { readonly candidateOperationIds: readonly string[]; readonly id: string; }[]} groups Comparison groups with their original candidate operation identities.
 * @returns {EveResponseGroupLineage | undefined} The owning group and valid latest retry replacements, or absence for missing, cyclic, or inapplicable lineage.
 */
// oxlint-disable-next-line eslint/complexity -- Candidate discovery, lineage validation, and retry selection form one fail-closed projection.
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
    // oxlint-disable-next-line no-ternary -- Keep = operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    current = current.parentConversationId
      ? conversationsById.get(current.parentConversationId)
      : undefined;
  }
  if (reversedLineage.length === 0 || current) {
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

  const children = new Map<string, LineageConversation[]>();
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
    // oxlint-disable-next-line no-ternary -- Keep originalBoundary as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    // oxlint-disable-next-line no-ternary -- Keep replacement as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  // oxlint-disable-next-line typescript/consistent-return -- #580: resolveEveResponseGroupLineage has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return { groupId: group.id, replacements };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (resolveEveResponseGroupLineage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null */
export { resolveEveResponseGroupLineage };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveResponseGroupLineage, EveResponseGroupLineageConversation); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { EveResponseGroupLineage, EveResponseGroupLineageConversation };
/* oxlint-enable import/no-named-export */
