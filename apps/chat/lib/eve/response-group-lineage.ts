import type { EveForkKind } from "./contracts";

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): EveResponseGroupLineageConversation is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): EveResponseGroupLineageConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EveResponseGroupLineageConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): EveResponseGroupLineage is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): EveResponseGroupLineage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EveResponseGroupLineage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export interface EveResponseGroupLineage {
  groupId: string;
  replacements: ReadonlyMap<
    string,
    { conversationId: string; sessionId: string }
  >;
}
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/explicit-function-return-type (#560): Keep localTurnBoundary's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): localTurnBoundary accepts conversation: EveResponseGroupLineageConversation; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): localTurnBoundary intentionally keeps the existing falsy-value behavior of conversation.forkMessageId; conversation.parentConversationId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const localTurnBoundary = (
  conversation: EveResponseGroupLineageConversation
) => {
  if (!conversation.parentConversationId || conversation.forkMessageId) {
    return "turn_0";
  }
  return conversation.forkTurnId;
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * no-magic-numbers (#517): laterConversation uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): laterConversation derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/prefer-readonly-parameter-types (#565): laterConversation accepts left: EveResponseGroupLineageConversation; right: EveResponseGroupLineageConversation; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const laterConversation = (
  left: EveResponseGroupLineageConversation,
  right: EveResponseGroupLineageConversation
): boolean =>
  left.createdAt.getTime() === right.createdAt.getTime()
    ? left.id.localeCompare(right.id) > 0
    : left.createdAt > right.createdAt;
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named resolveEveResponseGroupLineage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): resolveEveResponseGroupLineage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): resolveEveResponseGroupLineage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): resolveEveResponseGroupLineage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): resolveEveResponseGroupLineage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): resolveEveResponseGroupLineage skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): resolveEveResponseGroupLineage uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): resolveEveResponseGroupLineage derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): resolveEveResponseGroupLineage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): resolveEveResponseGroupLineage accepts conversations: readonly EveResponseGroupLineageConversation[]; groups: readonly { candidateOperationIds: readonly string[]; id: string }[]; conversation; group; entry; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): resolveEveResponseGroupLineage intentionally keeps the existing falsy-value behavior of current.parentConversationId; candidate; boundary; conversation.parentConversationId; originalBoundary; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): resolveEveResponseGroupLineage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
