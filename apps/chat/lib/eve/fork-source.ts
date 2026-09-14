import type { EveMessage } from "eve/client";

import type { EveForkInput, EveForkKind } from "./contracts";

const importedBoundary = /^seed_message_(?<messageIndex>0|[1-9][0-9]{0,3})$/u;
const nativeBoundary = /^turn_(?<turnIndex>0|[1-9][0-9]*)$/u;

export const eveUserForkBoundary = (
  message: Pick<EveMessage, "id" | "role" | "metadata">
) => {
  if (message.role !== "user" || message.metadata?.optimistic) {
    return;
  }
  if (
    message.metadata?.turnId &&
    nativeBoundary.test(message.metadata.turnId)
  ) {
    return message.metadata.turnId;
  }
  return importedBoundary.test(message.id) ? message.id : undefined;
};

export interface EveBranchReference {
  forkKind?: EveForkKind | null;
  forkMessageId?: string | null;
  forkTurnId: string | null;
  id: string;
  parentConversationId: string | null;
  responseGroupId?: string | null;
  responseGroupIndex?: number | null;
}

export interface EveMessageSiblingNavigation {
  currentIndex: number;
  siblings: { conversationId: string }[];
}

type Boundary =
  | { id: string; index: bigint; source: "imported" }
  | { id: string; index: bigint; source: "native" };

const parseBoundary = (branch: EveBranchReference): Boundary | undefined => {
  if (branch.forkMessageId && importedBoundary.test(branch.forkMessageId)) {
    return {
      id: branch.forkMessageId,
      index: BigInt(branch.forkMessageId.slice("seed_message_".length)),
      source: "imported",
    };
  }
  if (branch.forkTurnId && nativeBoundary.test(branch.forkTurnId)) {
    return {
      id: branch.forkTurnId,
      index: BigInt(branch.forkTurnId.slice("turn_".length)),
      source: "native",
    };
  }
};

const branchRole = (branch: EveBranchReference): "assistant" | "user" =>
  branch.forkKind === "regenerate" || branch.forkKind === "comparison"
    ? "assistant"
    : "user";

const localBoundary = (branch: EveBranchReference): Boundary | undefined => {
  const boundary = parseBoundary(branch);
  if (!boundary) {
    return;
  }
  return boundary.source === "imported"
    ? { id: "turn_0", index: 0n, source: "native" }
    : boundary;
};

const sameBoundary = (left: Boundary, right: Boundary) =>
  left.source === right.source && left.index === right.index;

const comparePosition = (
  left: { boundary: Boundary; role: "assistant" | "user" },
  right: { boundary: Boundary; role: "assistant" | "user" }
) => {
  if (left.boundary.source !== right.boundary.source) {
    return left.boundary.source === "imported" ? -1 : 1;
  }
  if (left.boundary.index !== right.boundary.index) {
    return left.boundary.index < right.boundary.index ? -1 : 1;
  }
  if (left.role === right.role) {
    return 0;
  }
  return left.role === "user" ? -1 : 1;
};

const selectedLineage = (
  conversationId: string,
  branchesById: ReadonlyMap<string, EveBranchReference>
) => {
  const reversed: EveBranchReference[] = [];
  const visited = new Set<string>();
  let branch = branchesById.get(conversationId);
  while (branch && !visited.has(branch.id)) {
    reversed.push(branch);
    visited.add(branch.id);
    branch = branch.parentConversationId
      ? branchesById.get(branch.parentConversationId)
      : undefined;
  }
  if (!reversed.length || branch) {
    return;
  }
  const lineage = reversed.toReversed();
  return lineage[0]?.parentConversationId ? undefined : lineage;
};

const findProjectedMessage = (
  messages: readonly Pick<EveMessage, "id" | "metadata" | "role">[],
  boundary: Boundary,
  role: "assistant" | "user"
) => {
  if (boundary.source === "native") {
    return messages.find(
      (message) =>
        message.role === role && message.metadata?.turnId === boundary.id
    );
  }
  const userIndex = messages.findIndex(
    (message) => message.role === "user" && message.id === boundary.id
  );
  if (role === "user") {
    return messages[userIndex];
  }
  if (userIndex === -1) {
    return;
  }
  const followingMessages = messages.slice(userIndex + 1);
  const nextUserIndex = followingMessages.findIndex(
    (message) => message.role === "user"
  );
  const sameTurnMessages =
    nextUserIndex === -1
      ? followingMessages
      : followingMessages.slice(0, nextUserIndex);
  return sameTurnMessages.find((message) => message.role === "assistant");
};

/**
 * Project session lineage back into the message siblings used by the original UI.
 * Unknown legacy fork intent is kept navigable at its user boundary; content is
 * never compared to guess whether it was an edit or a regeneration.
 */
// oxlint-disable-next-line eslint/complexity -- Lineage grouping, shadowing, and imported-boundary translation stay in one projection pass.
export const projectEveMessageSiblingNavigation = (
  conversationId: string,
  messages: readonly Pick<EveMessage, "id" | "metadata" | "role">[],
  branches: readonly EveBranchReference[]
): ReadonlyMap<string, EveMessageSiblingNavigation> => {
  const branchesById = new Map(branches.map((branch) => [branch.id, branch]));
  const lineage = selectedLineage(conversationId, branchesById);
  if (!lineage) {
    return new Map();
  }
  const lineageIndex = new Map(
    lineage.map((branch, index) => [branch.id, index])
  );
  const canonicalLocation = (branch: EveBranchReference) => {
    const visited = new Set<string>();
    const role = branchRole(branch);
    let baselineId = branch.parentConversationId;
    let boundary = parseBoundary(branch);
    while (baselineId && boundary && !visited.has(baselineId)) {
      visited.add(baselineId);
      const parent = branchesById.get(baselineId);
      if (!parent?.parentConversationId) {
        break;
      }
      const parentLocalBoundary = localBoundary(parent);
      const parentSourceBoundary = parseBoundary(parent);
      if (!(parentLocalBoundary && parentSourceBoundary)) {
        break;
      }
      if (
        comparePosition(
          { boundary: parentLocalBoundary, role: branchRole(parent) },
          { boundary, role }
        ) < 0
      ) {
        break;
      }
      if (sameBoundary(boundary, parentLocalBoundary)) {
        boundary = parentSourceBoundary;
      }
      baselineId = parent.parentConversationId;
    }
    return baselineId && boundary ? { baselineId, boundary, role } : undefined;
  };
  const groups = new Map<
    string,
    {
      baselineId: string;
      boundary: Boundary;
      members: EveBranchReference[];
      role: "assistant" | "user";
    }
  >();
  for (const branch of branches) {
    if (!(branch.parentConversationId && parseBoundary(branch))) {
      continue;
    }
    const location = canonicalLocation(branch);
    if (!location) {
      continue;
    }
    const key = JSON.stringify([
      location.baselineId,
      location.boundary.source,
      location.boundary.index.toString(),
      location.role,
    ]);
    const group = groups.get(key);
    if (group) {
      group.members.push(branch);
    } else {
      groups.set(key, { ...location, members: [branch] });
    }
  }
  const projection = new Map<string, EveMessageSiblingNavigation>();
  for (const { baselineId, boundary, members, role } of groups.values()) {
    const selectedMembers = members.filter((member) =>
      lineageIndex.has(member.id)
    );
    const [selected] = selectedMembers.toSorted(
      (left, right) =>
        (lineageIndex.get(right.id) ?? -1) - (lineageIndex.get(left.id) ?? -1)
    );
    const selectedBaseId = selected?.id ?? baselineId;
    const selectedBaseIndex = lineageIndex.get(selectedBaseId);
    if (selectedBaseIndex === undefined) {
      continue;
    }
    const messageBoundary = selected ? localBoundary(selected) : boundary;
    if (!messageBoundary) {
      continue;
    }
    const nextFork = lineage[selectedBaseIndex + 1];
    if (nextFork && !members.some((member) => member.id === nextFork.id)) {
      const nextBoundary = parseBoundary(nextFork);
      if (
        nextBoundary &&
        comparePosition(
          { boundary: nextBoundary, role: branchRole(nextFork) },
          { boundary: messageBoundary, role }
        ) <= 0
      ) {
        continue;
      }
    }
    const message = findProjectedMessage(messages, messageBoundary, role);
    if (!message) {
      continue;
    }
    const memberIds = new Set(members.map((member) => member.id));
    const baseline = branchesById.get(baselineId);
    const baselineBoundary = baseline ? localBoundary(baseline) : undefined;
    const inheritedCardGroupId =
      role === "assistant" &&
      baseline?.responseGroupId &&
      baselineBoundary &&
      sameBoundary(boundary, baselineBoundary)
        ? baseline.responseGroupId
        : undefined;
    const responseCardGroupId = (member: EveBranchReference) => {
      const visited = new Set<string>();
      let candidate: EveBranchReference | undefined = member;
      while (candidate && memberIds.has(candidate.id)) {
        if (candidate.forkKind === "comparison" && candidate.responseGroupId) {
          return candidate.responseGroupId;
        }
        if (candidate.forkKind !== "regenerate" || visited.has(candidate.id)) {
          return;
        }
        visited.add(candidate.id);
        candidate = candidate.parentConversationId
          ? branchesById.get(candidate.parentConversationId)
          : undefined;
      }
      return inheritedCardGroupId;
    };
    const alternativeKey = (member: EveBranchReference) =>
      responseCardGroupId(member) ?? member.responseGroupId ?? member.id;
    const alternatives = new Map<string, EveBranchReference[]>();
    for (const member of members) {
      const key = alternativeKey(member);
      const peers = alternatives.get(key);
      if (peers) {
        peers.push(member);
      } else {
        alternatives.set(key, [member]);
      }
    }
    const alternativeEntries = [...alternatives.entries()];
    const selectedComparisonGroup = selected
      ? responseCardGroupId(selected)
      : undefined;
    if (
      selectedComparisonGroup &&
      alternativeEntries.every(([key]) => key === selectedComparisonGroup)
    ) {
      // Cards own navigation within a pure comparison group.
      continue;
    }
    const includeBaseline =
      !selectedComparisonGroup ||
      alternativeEntries.some(
        ([key, peers]) =>
          key !== selectedComparisonGroup &&
          peers.every((peer) => !responseCardGroupId(peer))
      );
    // An ordinary regeneration proves the baseline contains this assistant
    // turn. Comparison-only siblings may be appended after the source ended,
    // so omit a predecessor whose message cannot be inferred from metadata.
    const siblings = includeBaseline ? [{ conversationId: baselineId }] : [];
    for (const [key, peers] of alternativeEntries) {
      const selectedPeer =
        selected && key === alternativeKey(selected) ? selected : undefined;
      const representative =
        selectedPeer ??
        peers.toSorted(
          (left, right) =>
            (left.responseGroupIndex ?? Number.MAX_SAFE_INTEGER) -
            (right.responseGroupIndex ?? Number.MAX_SAFE_INTEGER)
        )[0];
      if (representative) {
        siblings.push({ conversationId: representative.id });
      }
    }
    let selectedAlternative = includeBaseline ? 0 : -1;
    if (selected) {
      selectedAlternative =
        alternativeEntries.findIndex(
          ([key]) => key === alternativeKey(selected)
        ) + (includeBaseline ? 1 : 0);
    }
    if (selectedAlternative < 0) {
      continue;
    }
    projection.set(message.id, {
      currentIndex: selectedAlternative,
      siblings,
    });
  }
  return projection;
};

/** Resolve native checkpoint ancestry while keeping imported seed boundaries local. */
export const resolveForkSource = (
  conversationId: string,
  boundaryId: string,
  branches: readonly EveBranchReference[]
): EveForkInput => {
  if (
    importedBoundary.test(boundaryId) &&
    branches.some((branch) => branch.id === conversationId)
  ) {
    // Each descendant owns its retained seed prefix and document checkpoints.
    return { beforeMessageId: boundaryId, conversationId };
  }
  if (!nativeBoundary.test(boundaryId)) {
    throw new Error(
      "The source version is unavailable. Reload before editing."
    );
  }
  const beforeTurnId = boundaryId;
  const visited = new Set<string>();
  let current = branches.find((branch) => branch.id === conversationId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (
      !(current.parentConversationId && current.forkTurnId) ||
      BigInt(beforeTurnId.slice(5)) >= BigInt(current.forkTurnId.slice(5))
    ) {
      return { beforeTurnId, conversationId: current.id };
    }
    const parentId = current.parentConversationId;
    current = branches.find((branch) => branch.id === parentId);
  }
  throw new Error("The source version is unavailable. Reload before editing.");
};
