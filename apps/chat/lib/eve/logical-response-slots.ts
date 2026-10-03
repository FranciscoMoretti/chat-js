import type { LogicalBranch, LogicalChatSnapshot } from "./logical-chat";

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): belongsToSlot keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): belongsToSlot accepts branch: LogicalBranch; branches: readonly LogicalBranch[]; value; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const belongsToSlot = (
  branch: LogicalBranch,
  candidateId: string,
  branches: readonly LogicalBranch[]
): boolean => {
  const seen = new Set<string>();
  let current: LogicalBranch | undefined = branch;
  while (current && !seen.has(current.id)) {
    if (current.id === candidateId) {
      return true;
    }
    if (current.forkKind !== "regenerate") {
      return false;
    }
    seen.add(current.id);
    const parentId: string | null = current.parentConversationId;
    current = branches.find((value) => value.id === parentId);
  }
  return false;
};
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/no-named-export (#527): Preserve the named logicalResponseSlots API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): logicalResponseSlots remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): logicalResponseSlots's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): logicalResponseSlots's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): logicalResponseSlots keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): logicalResponseSlots uses -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): logicalResponseSlots derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): logicalResponseSlots uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-optional-chaining (#542): logicalResponseSlots handles optional groupBranch?.responseGroupId; node?.conversationId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): logicalResponseSlots copies or separates ...candidate while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep logicalResponseSlots's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep logicalResponseSlots's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): logicalResponseSlots accepts snapshot: LogicalChatSnapshot; branch; candidate; attempt; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): logicalResponseSlots intentionally keeps the existing falsy-value behavior of snapshot.branches.find( (branch) => branch.responseGroupId && userId === `group:${br; branch.responseGroupId; groupBranch?.responseGroupId; answer; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Slots retain admission order; retries append attempts, never another model slot. */
export const logicalResponseSlots = (
  snapshot: LogicalChatSnapshot,
  userId: string
) => {
  const groupBranch = snapshot.branches.find(
    (branch) =>
      branch.responseGroupId &&
      userId === `group:${branch.responseGroupId}:user`
  );
  if (!groupBranch?.responseGroupId) {
    return;
  }
  const groupId = groupBranch.responseGroupId;
  const candidates =
    groupBranch.groupCandidates ??
    snapshot.branches
      .filter((branch) => branch.responseGroupId === groupId)
      .map((branch) => ({
        modelId: branch.initialModelId ?? "Response",
        operationId: branch.operationId,
        rejection: undefined,
      }));
  const selectedPath = snapshot.paths.get(snapshot.conversationId) ?? [];
  // oxlint-disable-next-line oxc/no-map-spread -- #541: Derive UI slot metadata without mutating candidates retained by the lineage snapshot.
  const slots = candidates.map((candidate) => {
    const original = snapshot.branches.find(
      (branch) => branch.operationId === candidate.operationId
    );
    const attempts = original
      ? snapshot.branches
          .filter((branch) =>
            belongsToSlot(branch, original.id, snapshot.branches)
          )
          .flatMap((branch) => {
            const answer = (snapshot.paths.get(branch.id) ?? []).find((id) => {
              const node = snapshot.nodes.get(id);
              return (
                node?.conversationId === branch.id &&
                node.parentId === userId &&
                node.message.role === "assistant"
              );
            });
            return answer ? [{ answer, branch }] : [];
          })
      : [];
    const selectedAttempt = attempts.find((attempt) =>
      selectedPath.includes(attempt.answer)
    );
    const attempt = selectedAttempt ?? attempts.at(-1);
    return {
      ...candidate,
      attempt,
      original,
      selected: Boolean(selectedAttempt),
    };
  });
  // oxlint-disable-next-line typescript/consistent-return -- #580: logicalResponseSlots has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return { groupId, slots };
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
