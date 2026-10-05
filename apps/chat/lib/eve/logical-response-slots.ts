import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { LogicalBranch, LogicalChatSnapshot } from "./logical-chat";
/* oxlint-enable sort-imports */

const LAST_ATTEMPT_INDEX = -1;
interface SlotAttempt {
  answer: string;
  branch: LogicalBranch;
}
// Readers retain borrowed branch identities and keep node ownership inside answer matching.
interface SlotReadAccess {
  readonly branches: () => readonly LogicalBranch[];
  readonly path: (branchId: string) => readonly string[] | undefined;
  readonly answerMatches: (
    nodeId: string,
    branchId: string,
    userId: string
  ) => boolean;
}

type LogicalResponseSlot = NonNullable<
  LogicalBranch["groupCandidates"]
>[number] & {
  attempt: SlotAttempt | undefined;
  original: LogicalBranch | undefined;
  selected: boolean;
};

/* oxlint-disable max-statements --
 * max-statements (#512): belongsToSlot keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const belongsToSlot = (
  branch: ReadonlyNativeSurface<LogicalBranch>,
  candidateId: string,
  branches: readonly ReadonlyNativeSurface<LogicalBranch>[]
): boolean => {
  const seen = new Set<string>();
  let current: ReadonlyNativeSurface<LogicalBranch> | undefined = branch;
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
/* oxlint-enable max-statements */

// This guard retains the existing truthiness gate while exposing its string narrowing.
const hasSlotAnswer = (answer: string | undefined): answer is string =>
  Boolean(answer);

const slotReadAccess = (
  branches: () => readonly LogicalBranch[],
  path: (branchId: string) => readonly string[] | undefined,
  node: (nodeId: string) => ReturnType<LogicalChatSnapshot["nodes"]["get"]>
): SlotReadAccess => ({
  answerMatches: (nodeId, branchId, userId) => {
    const value = node(nodeId);
    return (
      value?.conversationId === branchId &&
      value.parentId === userId &&
      value.message.role === "assistant"
    );
  },
  branches,
  path,
});

const slotAttempts = (
  read: SlotReadAccess,
  original: ReadonlyNativeSurface<LogicalBranch> | undefined,
  userId: string
): SlotAttempt[] => {
  if (!original) {
    return [];
  }
  // Finish ancestry filtering before inspecting any answer paths, as in the original projection.
  const matching = read
    .branches()
    .filter((branch: ReadonlyNativeSurface<LogicalBranch>) =>
      belongsToSlot(branch, original.id, read.branches())
    );
  const attempts: SlotAttempt[] = [];
  for (const branch of matching) {
    const answer = (read.path(branch.id) ?? []).find((id) =>
      read.answerMatches(id, branch.id, userId)
    );
    if (hasSlotAnswer(answer)) {
      attempts.push({ answer, branch });
    }
  }
  return attempts;
};

const selectedSlotAttempt = (
  read: () => readonly SlotAttempt[],
  selectedPath: readonly string[]
): { attempt: SlotAttempt | undefined; selected: boolean } => {
  const selected = read().find((attempt: ReadonlyNativeSurface<SlotAttempt>) =>
    selectedPath.includes(attempt.answer)
  );
  return {
    attempt: selected ?? read().at(LAST_ATTEMPT_INDEX),
    selected: Boolean(selected),
  };
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (logicalResponseSlots); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * no-undefined (#519): logicalResponseSlots uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): logicalResponseSlots accepts snapshot: LogicalChatSnapshot; branch; candidate; attempt; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): logicalResponseSlots intentionally keeps the existing falsy-value behavior of snapshot.branches.find( (branch) => branch.responseGroupId && userId === `group:${br; branch.responseGroupId; groupBranch?.responseGroupId; answer; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * Retains admitted model-slot order while regeneration appends attempts to existing slots.
 * @param {LogicalChatSnapshot} snapshot Logical lineage whose branch paths identify original candidates and regenerated answers.
 * @param {string} userId Logical group user-message identity used to locate its admitted response group.
 * @returns {{ groupId: string; slots: LogicalResponseSlot[] } | undefined} Group slots with original branches, latest/selected attempts, and rejection metadata, or no result for other messages.
 */
export const logicalResponseSlots = (
  snapshot: LogicalChatSnapshot,
  userId: string
): { groupId: string; slots: LogicalResponseSlot[] } | undefined => {
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
  const read = slotReadAccess(
    () => snapshot.branches,
    (branchId) => snapshot.paths.get(branchId),
    (nodeId) => snapshot.nodes.get(nodeId)
  );
  // oxlint-disable-next-line oxc/no-map-spread -- #541: Derive UI slot metadata without mutating candidates retained by the lineage snapshot.
  const slots = candidates.map((candidate) => {
    const original = snapshot.branches.find(
      (branch) => branch.operationId === candidate.operationId
    );
    const attempts = slotAttempts(read, original, userId);
    const { attempt, selected } = selectedSlotAttempt(
      () => attempts,
      selectedPath
    );
    return {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...candidate,
      attempt,
      original,
      selected,
    };
  });
  // oxlint-disable-next-line typescript/consistent-return -- #580: logicalResponseSlots has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return { groupId, slots };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
