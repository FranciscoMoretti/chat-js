import { parallelResponseDetails } from "./response-group-contracts";
import type { SavedResponseCandidate } from "./response-group-contracts";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { sharedPromptMessageId } from "@/lib/eve/logical-chat";
import type {
  LogicalBranch,
  LogicalChatSnapshot,
} from "@/lib/eve/logical-chat";

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

type SlotCandidate = Omit<SavedResponseCandidate, "modelId"> & {
  modelId: string | null;
};

type LogicalResponseSlot = SlotCandidate & {
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
    const parentId: string | null = current.parentBranchId;
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
      value?.branchId === branchId &&
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
        "branches" | "paths" | "branchId" | "nodes" | "promptGroups"
      >
    >
  >,
  userId: string
): { groupId: string; slots: LogicalResponseSlot[] } | undefined => {
  const group = snapshot.promptGroups.find(
    (entry) => userId === sharedPromptMessageId(entry.id)
  );
  if (!group) {
    return undefined;
  }
  const details = parallelResponseDetails.safeParse(group.details);
  if (!details.success) {
    return undefined;
  }
  // Older saved comparisons have ordering but no candidate records.
  const byOperation = new Map(
    snapshot.branches.map((branch) => [branch.operationId, branch])
  );
  const candidates: readonly SlotCandidate[] =
    details.data.candidates ??
    group.operationIds.flatMap((operationId) => {
      const branch = byOperation.get(operationId);
      return branch ? [{ modelId: branch.initialModelId, operationId }] : [];
    });
  const selectedPath = snapshot.paths.get(snapshot.branchId) ?? [];
  const read = slotReadAccess(
    () => snapshot.branches,
    (branchId) => snapshot.paths.get(branchId),
    (nodeId) => snapshot.nodes.get(nodeId)
  );
  const slots = candidates.map((candidate) => {
    const original = byOperation.get(candidate.operationId);
    const attempts = slotAttempts(read, original, userId);
    const { attempt, selected } = selectedSlotAttempt(
      () => attempts,
      selectedPath
    );
    return {
      ...candidate,
      rejection: original ? undefined : candidate.rejection,
      attempt,
      original,
      selected,
    };
  });
  return { groupId: group.id, slots };
};
