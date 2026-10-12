import { isNonEmptyString } from "@/lib/is-non-empty-string";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import type { LogicalBranch, LogicalChatSnapshot } from "./logical-chat";

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

/**
 * Retains admitted model-slot order while regeneration appends attempts to existing slots.
 * @param {LogicalChatSnapshot} snapshot Logical lineage whose branch paths identify original candidates and regenerated answers.
 * @param {string} userId Logical group user-message identity used to locate its admitted response group.
 * @returns {{ groupId: string; slots: LogicalResponseSlot[] } | undefined} Group slots with original branches, latest/selected attempts, and rejection metadata, or no result for other messages.
 */
export const logicalResponseSlots = (
  snapshot: ReadonlyNativeSurface<
    Readonly<
      Pick<
        LogicalChatSnapshot,
        "branches" | "paths" | "conversationId" | "nodes"
      >
    >
  >,
  userId: string
): { groupId: string; slots: LogicalResponseSlot[] } | undefined => {
  const groupBranch = snapshot.branches.find(
    (branch: Readonly<Pick<LogicalBranch, "responseGroupId">>) =>
      isNonEmptyString(branch.responseGroupId) &&
      userId === `group:${branch.responseGroupId}:user`
  );
  if (!isNonEmptyString(groupBranch?.responseGroupId)) {
    return undefined;
  }
  const groupId = groupBranch.responseGroupId;
  const candidates =
    groupBranch.groupCandidates ??
    snapshot.branches
      .filter(
        (branch: Readonly<Pick<LogicalBranch, "responseGroupId">>) =>
          branch.responseGroupId === groupId
      )
      .map(
        (
          branch: Readonly<
            Pick<LogicalBranch, "initialModelId" | "operationId">
          >
        ) => ({
          modelId: branch.initialModelId ?? "Response",
          operationId: branch.operationId,
          rejection: undefined,
        })
      );
  const selectedPath = snapshot.paths.get(snapshot.conversationId) ?? [];
  const read = slotReadAccess(
    () => snapshot.branches,
    (branchId) => snapshot.paths.get(branchId),
    (nodeId) => snapshot.nodes.get(nodeId)
  );
  const slots = candidates.map((candidate) => {
    const original = snapshot.branches.find(
      (branch: Readonly<Pick<LogicalBranch, "operationId">>) =>
        branch.operationId === candidate.operationId
    );
    const attempts = slotAttempts(read, original, userId);
    const { attempt, selected } = selectedSlotAttempt(
      () => attempts,
      selectedPath
    );
    return {
      ...candidate,
      attempt,
      original,
      selected,
    };
  });
  return { groupId, slots };
};
