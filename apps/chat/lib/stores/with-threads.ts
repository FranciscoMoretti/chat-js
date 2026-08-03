"use client";

// Middleware that extends @/lib/stores/base with thread epoch tracking
// and complete message tree management for branching/sibling navigation.
// The store owns allMessages (the full tree); React Query feeds data into it.

import type { MessageTreeSnapshot } from "@chatjs/thread";
import type { UIMessage } from "ai";
import type { StateCreator } from "zustand";
import type { StoreState as BaseChatStoreState } from "@/lib/stores/base";
import type { MessageNode } from "@/lib/thread-utils";

export interface MessageSiblingInfo<UM> {
  siblingIndex: number;
  siblings: UM[];
}

export interface ParallelGroupInfo<UM> {
  messages: UM[];
  parallelGroupId: string;
  selectedMessageId: string | null;
}

export type ThreadAugmentedState<UM extends UIMessage> =
  BaseChatStoreState<UM> & {
    threadEpoch: number;
    /**
     * Snapshot of the currently-active thread to use as "initial messages" for
     * useChat on remounts. Intentionally NOT kept in sync with live messages;
     * only updated when switching threads (setMessagesWithEpoch) and on store init.
     */
    threadInitialMessages: UM[];
    /** Complete message tree (all branches). Source of truth for sibling navigation. */
    allMessages: UM[];
    /** Headless package snapshot for the same message tree. */
    treeSnapshot: MessageTreeSnapshot<UM>;
    treeSnapshotSignature: string;
    /** Parent→children mapping, rebuilt when allMessages changes. */
    childrenMap: Map<string | null, UM[]>;
    bumpThreadEpoch: () => void;
    resetThreadEpoch: () => void;
    setMessagesWithEpoch: (messages: UM[]) => void;
    /** Replace the package tree snapshot and derive store fields from it. */
    setTreeSnapshot: (snapshot: MessageTreeSnapshot<UM>) => void;
    /** Replace the full message tree (used when syncing from server). */
    setAllMessages: (messages: UM[]) => void;
    /** Add or replace a single message in the tree (used during streaming/sending). */
    addMessageToTree: (message: UM) => void;
    /** Look up sibling info for a message. */
    getMessageSiblingInfo: (messageId: string) => MessageSiblingInfo<UM> | null;
    getParallelGroupInfo: (messageId: string) => ParallelGroupInfo<UM> | null;
    /**
     * Switch to a sibling thread. Returns the new thread array,
     * or null if no switch was possible.
     */
    switchToSibling: (
      messageId: string,
      direction: "prev" | "next"
    ) => UM[] | null;
    switchToMessage: (messageId: string) => UM[] | null;
  };

function getMetadataParentId<UM extends UIMessage>(message: UM) {
  return ((message as UM & MessageNode).metadata?.parentMessageId ?? null) as
    | string
    | null;
}

function getMessageTimestamp<UM extends UIMessage>(message: UM) {
  const createdAt = (message as UM & MessageNode).metadata?.createdAt;
  if (!createdAt) {
    return 0;
  }
  return createdAt instanceof Date
    ? createdAt.getTime()
    : new Date(createdAt).getTime();
}

function compareSiblingMessages<UM extends UIMessage>(a: UM, b: UM) {
  const aMetadata = (a as UM & MessageNode).metadata;
  const bMetadata = (b as UM & MessageNode).metadata;
  const sameParallelGroup =
    aMetadata?.parallelGroupId &&
    aMetadata.parallelGroupId === bMetadata?.parallelGroupId;

  if (
    sameParallelGroup &&
    typeof aMetadata.parallelIndex === "number" &&
    typeof bMetadata?.parallelIndex === "number" &&
    aMetadata.parallelIndex !== bMetadata.parallelIndex
  ) {
    return aMetadata.parallelIndex - bMetadata.parallelIndex;
  }

  return getMessageTimestamp(a) - getMessageTimestamp(b);
}

function buildTreeSnapshotFromMessages<UM extends UIMessage>(
  messages: UM[],
  cursorId: string | null = messages.at(-1)?.id ?? null
): MessageTreeSnapshot<UM> {
  const messagesById = new Map(
    messages.map((message) => [message.id, message])
  );
  const childrenByParentId = new Map<string | null, UM[]>();

  for (const message of messages) {
    const metadataParentId = getMetadataParentId(message);
    const parentId =
      metadataParentId && messagesById.has(metadataParentId)
        ? metadataParentId
        : null;
    childrenByParentId.set(parentId, [
      ...(childrenByParentId.get(parentId) ?? []),
      message,
    ]);
  }

  for (const children of childrenByParentId.values()) {
    children.sort(compareSiblingMessages);
  }

  const nodes: MessageTreeSnapshot<UM>["nodes"] = [];
  const visited = new Set<string>();
  const visit = (message: UM, parentId: string | null) => {
    if (visited.has(message.id)) {
      return;
    }
    visited.add(message.id);
    nodes.push({ message, parentId });
    for (const child of childrenByParentId.get(message.id) ?? []) {
      visit(child, message.id);
    }
  };

  for (const root of childrenByParentId.get(null) ?? []) {
    visit(root, null);
  }
  for (const message of messages) {
    visit(message, null);
  }

  return {
    cursorId,
    nodes,
    version: 1,
  };
}

function getSnapshotIndexes<UM extends UIMessage>(
  snapshot: MessageTreeSnapshot<UM>
) {
  const childrenByParentId = new Map<string | null, string[]>();
  const parentById = new Map<string, string | null>();
  const rootIds: string[] = [];

  for (const { message, parentId } of snapshot.nodes) {
    const children = childrenByParentId.get(parentId);
    if (children) {
      children.push(message.id);
    } else {
      childrenByParentId.set(parentId, [message.id]);
    }
    parentById.set(message.id, parentId);
    if (parentId === null) {
      rootIds.push(message.id);
    }
  }

  return { childrenByParentId, parentById, rootIds };
}

function getSnapshotParentId<UM extends UIMessage>(
  snapshot: MessageTreeSnapshot<UM>,
  message: UM
) {
  const { parentById } = getSnapshotIndexes(snapshot);
  return parentById.has(message.id)
    ? (parentById.get(message.id) ?? null)
    : getMetadataParentId(message);
}

function mergeTreeSnapshot<UM extends UIMessage>(
  incomingSnapshot: MessageTreeSnapshot<UM>,
  existingSnapshot: MessageTreeSnapshot<UM>,
  messages: UM[]
): MessageTreeSnapshot<UM> {
  const messagesById = new Map(
    messages.map((message) => [message.id, message])
  );
  const incomingParents = getSnapshotIndexes(incomingSnapshot).parentById;
  const existingParents = getSnapshotIndexes(existingSnapshot).parentById;
  const orderedMessageIds = [
    ...existingSnapshot.nodes.map(({ message }) => message.id),
    ...incomingSnapshot.nodes.map(({ message }) => message.id),
    ...messages.map((message) => message.id),
  ];
  const uniqueOrderedMessageIds = [...new Set(orderedMessageIds)].filter((id) =>
    messagesById.has(id)
  );
  const parentById = new Map<string, string | null>();
  const childrenByParentId = new Map<string | null, string[]>();

  for (const messageId of uniqueOrderedMessageIds) {
    const message = messagesById.get(messageId);
    if (!message) {
      continue;
    }

    let parentId = getMetadataParentId(message);
    if (incomingParents.has(messageId)) {
      parentId = incomingParents.get(messageId) ?? null;
    } else if (existingParents.has(messageId)) {
      parentId = existingParents.get(messageId) ?? null;
    }
    const validParentId =
      parentId !== messageId && parentId !== null && messagesById.has(parentId)
        ? parentId
        : null;
    parentById.set(messageId, validParentId);

    const children = childrenByParentId.get(validParentId);
    if (children) {
      children.push(messageId);
    } else {
      childrenByParentId.set(validParentId, [messageId]);
    }
  }

  const nodes: MessageTreeSnapshot<UM>["nodes"] = [];
  const visited = new Set<string>();
  const visit = (messageId: string, parentId: string | null) => {
    if (visited.has(messageId)) {
      return;
    }
    const message = messagesById.get(messageId);
    if (!message) {
      return;
    }

    visited.add(messageId);
    nodes.push({ message, parentId });
    for (const childId of childrenByParentId.get(messageId) ?? []) {
      visit(childId, messageId);
    }
  };

  for (const rootId of childrenByParentId.get(null) ?? []) {
    visit(rootId, null);
  }
  // Invalid cyclic topology is recovered as an additional root rather than
  // leaking a cycle into traversal or into ThreadChat on the next remount.
  for (const messageId of uniqueOrderedMessageIds) {
    visit(messageId, null);
  }

  return {
    cursorId: incomingSnapshot.cursorId,
    nodes,
    version: 1,
  };
}

function buildChildrenMapFromSnapshot<UM extends UIMessage>(
  messages: UM[],
  snapshot: MessageTreeSnapshot<UM>
): Map<string | null, UM[]> {
  const messagesById = new Map(
    messages.map((message) => [message.id, message])
  );
  const map = new Map<string | null, UM[]>();
  const { childrenByParentId } = getSnapshotIndexes(snapshot);

  for (const [parentId, childIds] of childrenByParentId) {
    map.set(
      parentId,
      childIds
        .map((id) => messagesById.get(id))
        .filter((message): message is UM => Boolean(message))
    );
  }

  return map;
}

function buildThreadFromSnapshot<UM extends UIMessage>(
  messages: UM[],
  snapshot: MessageTreeSnapshot<UM>,
  leafMessageId: string
): UM[] {
  const messagesById = new Map(
    messages.map((message) => [message.id, message])
  );
  const { parentById } = getSnapshotIndexes(snapshot);
  const thread: UM[] = [];
  let currentMessageId: string | null = leafMessageId;
  const visited = new Set<string>();

  while (currentMessageId) {
    if (visited.has(currentMessageId)) {
      break;
    }
    visited.add(currentMessageId);

    const currentMessage = messagesById.get(currentMessageId);
    if (!currentMessage) {
      break;
    }

    thread.push(currentMessage);
    currentMessageId = parentById.get(currentMessageId) ?? null;
  }

  return thread.reverse();
}

function findLeafDfsToRightFromSnapshot<UM extends UIMessage>(
  snapshot: MessageTreeSnapshot<UM>,
  messageId: string
): string | null {
  const { childrenByParentId } = getSnapshotIndexes(snapshot);
  const visited = new Set([messageId]);
  let currentMessageId = messageId;
  let leafMessageId: string | null = null;

  while (true) {
    const rightmostChild = childrenByParentId.get(currentMessageId)?.at(-1);
    if (!rightmostChild || visited.has(rightmostChild)) {
      return leafMessageId;
    }
    visited.add(rightmostChild);
    leafMessageId = rightmostChild;
    currentMessageId = rightmostChild;
  }
}

function findRightmostLeafFromSnapshot<UM extends UIMessage>(
  snapshot: MessageTreeSnapshot<UM>
) {
  const { rootIds } = getSnapshotIndexes(snapshot);
  const rightmostRoot = rootIds.at(-1);
  if (!rightmostRoot) {
    return null;
  }
  return (
    findLeafDfsToRightFromSnapshot(snapshot, rightmostRoot) ?? rightmostRoot
  );
}

function getSnapshotSignature<UM extends UIMessage>(
  snapshot: MessageTreeSnapshot<UM>
) {
  return JSON.stringify(snapshot);
}

type MetadataWithSelectedModel = MessageNode["metadata"] & {
  selectedModel?: unknown;
  selectedTool?: unknown;
};

function mergeMessageIntoMap<UM extends UIMessage>(
  merged: Map<string, UM>,
  message: UM
) {
  const existing = merged.get(message.id);
  const existingMetadata = (existing as (UM & MessageNode) | undefined)
    ?.metadata;
  if (
    existing &&
    (message as UM & MessageNode).metadata === undefined &&
    existingMetadata !== undefined
  ) {
    merged.set(message.id, {
      ...message,
      metadata: {
        ...existingMetadata,
      },
    } as UM);
    return;
  }

  merged.set(message.id, message);
}

function addFallbackMetadataToMessages<UM extends UIMessage>(
  merged: Map<string, UM>,
  parentById: ReadonlyMap<string, string | null>
) {
  for (const [messageId, message] of merged) {
    if ((message as UM & MessageNode).metadata !== undefined) {
      continue;
    }

    const parentId = parentById.get(messageId) ?? null;
    const parent = parentId ? merged.get(parentId) : undefined;
    const parentMetadata = (parent as (UM & MessageNode) | undefined)
      ?.metadata as MetadataWithSelectedModel | undefined;

    if (!(parentMetadata && "selectedModel" in parentMetadata)) {
      continue;
    }

    merged.set(messageId, {
      ...message,
      metadata: {
        activeStreamId: null,
        createdAt: parentMetadata.createdAt,
        isPrimaryParallel: null,
        parallelGroupId: null,
        parallelIndex: null,
        parentMessageId: parentId,
        selectedModel: parentMetadata.selectedModel,
        selectedTool: parentMetadata.selectedTool,
      },
    } as UM);
  }
}

export const withThreads =
  <UI_MESSAGE extends UIMessage, T extends BaseChatStoreState<UI_MESSAGE>>(
    creator: StateCreator<T, [], []>
  ): StateCreator<T & ThreadAugmentedState<UI_MESSAGE>, [], []> =>
  (set, get, api) => {
    const base = creator(set, get, api);

    // Wrap the original setMessages to auto-bump epoch
    const originalSetMessages = base.setMessages;

    const rebuildMap = (
      msgs: UI_MESSAGE[],
      snapshot = buildTreeSnapshotFromMessages(msgs)
    ) => buildChildrenMapFromSnapshot(msgs, snapshot);

    const mergeTreeMessages = (
      serverMessages: UI_MESSAGE[],
      existingTreeMessages: UI_MESSAGE[],
      currentVisibleMessages: UI_MESSAGE[],
      parentById: ReadonlyMap<string, string | null> = new Map()
    ): UI_MESSAGE[] => {
      const merged = new Map<string, UI_MESSAGE>();

      for (const message of existingTreeMessages) {
        mergeMessageIntoMap(merged, message);
      }

      for (const message of serverMessages) {
        mergeMessageIntoMap(merged, message);
      }

      // Preserve in-flight visible messages when server data is still stale.
      for (const message of currentVisibleMessages) {
        mergeMessageIntoMap(merged, message);
      }

      addFallbackMetadataToMessages(merged, parentById);
      return Array.from(merged.values());
    };
    const initialSnapshot = buildTreeSnapshotFromMessages(base.messages);

    return {
      ...base,
      threadEpoch: 0,
      threadInitialMessages: base.messages,
      allMessages: base.messages,
      treeSnapshot: initialSnapshot,
      treeSnapshotSignature: getSnapshotSignature(initialSnapshot),
      childrenMap: rebuildMap(base.messages, initialSnapshot),

      bumpThreadEpoch: () => {
        set((state) => ({
          ...state,
          threadEpoch: state.threadEpoch + 1,
        }));
      },

      resetThreadEpoch: () => {
        set((state) => ({
          ...state,
          threadEpoch: 0,
          threadInitialMessages: get().messages,
        }));
      },

      setMessagesWithEpoch: (messages: UI_MESSAGE[]) => {
        const cursorId = messages.at(-1)?.id ?? null;
        get()._messageIndex.update(messages);
        set((state) => {
          const snapshot = buildTreeSnapshotFromMessages(
            state.allMessages,
            cursorId
          );
          return {
            ...state,
            messages,
            _memoizedSelectors: new Map(),
            _throttledMessages: messages,
            threadEpoch: state.threadEpoch + 1,
            threadInitialMessages: messages,
            treeSnapshot: snapshot,
            treeSnapshotSignature: getSnapshotSignature(snapshot),
            childrenMap: rebuildMap(state.allMessages, snapshot),
          };
        });
      },

      setTreeSnapshot: (snapshot: MessageTreeSnapshot<UI_MESSAGE>) => {
        const state = get();
        const snapshotIndexes = getSnapshotIndexes(snapshot);
        const snapshotMessages = snapshot.nodes.map(({ message }) => message);
        const mergedMessages = mergeTreeMessages(
          snapshotMessages,
          state.allMessages,
          [],
          snapshotIndexes.parentById
        );
        const mergedSnapshot = mergeTreeSnapshot(
          snapshot,
          state.treeSnapshot,
          mergedMessages
        );
        const signature = getSnapshotSignature(mergedSnapshot);
        if (state.treeSnapshotSignature === signature) {
          return;
        }

        const nextVisibleThread = mergedSnapshot.cursorId
          ? buildThreadFromSnapshot(
              mergedMessages,
              mergedSnapshot,
              mergedSnapshot.cursorId
            )
          : [];

        state._messageIndex.update(nextVisibleThread);
        set((prev) => ({
          ...prev,
          messages: nextVisibleThread,
          _memoizedSelectors: new Map(),
          _throttledMessages: nextVisibleThread,
          allMessages: mergedMessages,
          treeSnapshot: mergedSnapshot,
          treeSnapshotSignature: signature,
          childrenMap: rebuildMap(mergedMessages, mergedSnapshot),
        }));
      },

      setAllMessages: (messages: UI_MESSAGE[]) => {
        const state = get();
        const currentVisibleMessages = state.messages;
        const existingTreeMessages = state.allMessages;
        const mergedMessages = mergeTreeMessages(
          messages,
          existingTreeMessages,
          state.status === "streaming" || state.status === "submitted"
            ? currentVisibleMessages
            : []
        );
        let snapshot = buildTreeSnapshotFromMessages(
          mergedMessages,
          currentVisibleMessages.at(-1)?.id ?? null
        );

        // The live runtime remains authoritative while streaming. Query data can
        // lag behind stream chunks, so merge it into the tree index without
        // replacing the visible path until post-stream invalidation.
        if (state.status === "streaming" || state.status === "submitted") {
          set((prev) => ({
            ...prev,
            allMessages: mergedMessages,
            treeSnapshot: snapshot,
            treeSnapshotSignature: getSnapshotSignature(snapshot),
            childrenMap: rebuildMap(mergedMessages, snapshot),
          }));
          return;
        }

        const currentLeafId = currentVisibleMessages.at(-1)?.id;
        const selectedLeafId =
          currentLeafId ?? findRightmostLeafFromSnapshot(snapshot);
        if (selectedLeafId && snapshot.cursorId !== selectedLeafId) {
          snapshot = {
            ...snapshot,
            cursorId: selectedLeafId,
          };
        }
        const nextVisibleThread = selectedLeafId
          ? buildThreadFromSnapshot(mergedMessages, snapshot, selectedLeafId)
          : currentVisibleMessages;

        originalSetMessages(nextVisibleThread);
        set((prev) => ({
          ...prev,
          messages: nextVisibleThread,
          _memoizedSelectors: new Map(),
          _throttledMessages: nextVisibleThread,
          allMessages: mergedMessages,
          treeSnapshot: snapshot,
          treeSnapshotSignature: getSnapshotSignature(snapshot),
          childrenMap: rebuildMap(mergedMessages, snapshot),
        }));
      },

      addMessageToTree: (message: UI_MESSAGE) => {
        set((state) => {
          const idx = state.allMessages.findIndex((m) => m.id === message.id);
          let next: UI_MESSAGE[];
          if (idx === -1) {
            next = [...state.allMessages, message];
          } else {
            next = [...state.allMessages];
            const existing = next[idx];
            const existingMetadata = (
              existing as (UI_MESSAGE & MessageNode) | undefined
            )?.metadata;
            next[idx] =
              existing &&
              (message as UI_MESSAGE & MessageNode).metadata === undefined &&
              existingMetadata !== undefined
                ? ({
                    ...message,
                    metadata: {
                      ...existingMetadata,
                    },
                  } as UI_MESSAGE)
                : message;
          }
          const snapshot = buildTreeSnapshotFromMessages(
            next,
            state.messages.at(-1)?.id ?? null
          );
          return {
            ...state,
            allMessages: next,
            treeSnapshot: snapshot,
            treeSnapshotSignature: getSnapshotSignature(snapshot),
            childrenMap: rebuildMap(next, snapshot),
          };
        });
      },

      getMessageSiblingInfo: (
        messageId: string
      ): MessageSiblingInfo<UI_MESSAGE> | null => {
        const state = get();
        const { allMessages, childrenMap } = state;
        const message = allMessages.find((m) => m.id === messageId);
        if (!message) {
          return null;
        }

        const parentId = getSnapshotParentId(state.treeSnapshot, message);
        const siblings = (childrenMap.get(parentId) ?? []) as UI_MESSAGE[];
        const siblingIndex = siblings.findIndex((s) => s.id === messageId);

        return { siblings, siblingIndex };
      },

      getParallelGroupInfo: (
        messageId: string
      ): ParallelGroupInfo<UI_MESSAGE> | null => {
        const state = get();
        const message = state.allMessages.find((item) => item.id === messageId);
        if (!message) {
          return null;
        }

        const metadata = (message as UI_MESSAGE & MessageNode).metadata;
        const parallelGroupId = metadata?.parallelGroupId || null;
        const parentId =
          message.role === "user"
            ? message.id
            : getSnapshotParentId(state.treeSnapshot, message);

        if (!(parentId && parallelGroupId)) {
          return null;
        }

        const groupMessages = (
          (state.childrenMap.get(parentId) ?? []) as UI_MESSAGE[]
        )
          .filter(
            (candidate) =>
              (candidate as UI_MESSAGE & MessageNode).metadata
                ?.parallelGroupId === parallelGroupId
          )
          .sort((a, b) => {
            const aIndex =
              (a as UI_MESSAGE & MessageNode).metadata?.parallelIndex ??
              Number.MAX_SAFE_INTEGER;
            const bIndex =
              (b as UI_MESSAGE & MessageNode).metadata?.parallelIndex ??
              Number.MAX_SAFE_INTEGER;

            if (aIndex !== bIndex) {
              return aIndex - bIndex;
            }

            return 0;
          });

        const visibleMessageIds = new Set(state.messages.map((m) => m.id));
        const selectedMessageId =
          groupMessages.find((candidate) => visibleMessageIds.has(candidate.id))
            ?.id ?? null;

        return {
          messages: groupMessages,
          parallelGroupId,
          selectedMessageId,
        };
      },

      switchToSibling: (
        messageId: string,
        direction: "prev" | "next"
      ): UI_MESSAGE[] | null => {
        const state = get();
        const { allMessages } = state;
        if (!allMessages.length) {
          return null;
        }

        const siblingInfo = state.getMessageSiblingInfo(messageId);
        if (!siblingInfo || siblingInfo.siblings.length <= 1) {
          return null;
        }

        const { siblings, siblingIndex } = siblingInfo;
        const nextIndex =
          direction === "next"
            ? (siblingIndex + 1) % siblings.length
            : (siblingIndex - 1 + siblings.length) % siblings.length;

        const targetSibling = siblings[nextIndex];
        const leafId = findLeafDfsToRightFromSnapshot(
          state.treeSnapshot,
          targetSibling.id
        );
        const newThread = buildThreadFromSnapshot(
          allMessages,
          state.treeSnapshot,
          leafId ?? targetSibling.id
        ) as UI_MESSAGE[];

        state.setMessagesWithEpoch(newThread);
        return newThread;
      },

      switchToMessage: (messageId: string): UI_MESSAGE[] | null => {
        const state = get();
        const { allMessages } = state;
        const message = allMessages.find(
          (candidate) => candidate.id === messageId
        );
        if (!message) {
          return null;
        }

        const leafId = findLeafDfsToRightFromSnapshot(
          state.treeSnapshot,
          messageId
        );
        const newThread = buildThreadFromSnapshot(
          allMessages,
          state.treeSnapshot,
          leafId ?? messageId
        ) as UI_MESSAGE[];

        state.setMessagesWithEpoch(newThread);
        return newThread;
      },

      // Override setMessages to auto-bump epoch when thread changes
      setMessages: (messages: UI_MESSAGE[]) => {
        const currentMessages = get().messages;
        const currentIds = currentMessages.map((m) => m.id).join(",");
        const newIds = messages.map((m) => m.id).join(",");

        originalSetMessages(messages);

        // Only bump epoch if the thread structure actually changed
        if (currentIds !== newIds) {
          const snapshot = buildTreeSnapshotFromMessages(
            get().allMessages,
            messages.at(-1)?.id ?? null
          );
          set((state) => ({
            ...state,
            threadEpoch: state.threadEpoch + 1,
            treeSnapshot: snapshot,
            treeSnapshotSignature: getSnapshotSignature(snapshot),
            childrenMap: rebuildMap(state.allMessages, snapshot),
          }));
        }
      },
    };
  };
