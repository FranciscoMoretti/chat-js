import type { LogicalBranch, LogicalChatSnapshot } from "./logical-chat";

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
    return { ...candidate, attempt, original, selected: !!selectedAttempt };
  });
  return { groupId, slots };
};
