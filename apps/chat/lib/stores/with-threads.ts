"use client";

// Middleware that extends @/lib/stores/base with thread epoch tracking
// and complete message tree management for branching/sibling navigation.
// The store owns allMessages (the full tree); React Query feeds data into it.

import { type MessageTreeSnapshot, ROOT_PARENT_ID } from "@chatjs/thread";
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

function parentKey(parentId: string | null) {
  return parentId ?? ROOT_PARENT_ID;
}

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
  const messagesById: Record<string, UM> = {};
  const parentById: Record<string, string | null> = {};
  const childrenByParentId: Record<string, string[]> = {};

  for (const message of messages) {
    const parentId = getMetadataParentId(message);
    messagesById[message.id] = message;
    parentById[message.id] = parentId;

    const key = parentKey(parentId);
    childrenByParentId[key] = [...(childrenByParentId[key] ?? []), message.id];
  }

  for (const childIds of Object.values(childrenByParentId)) {
    childIds.sort((a, b) =>
      compareSiblingMessages(messagesById[a] as UM, messagesById[b] as UM)
    );
  }

  return {
    childrenByParentId,
    cursorId,
    messagesById,
    parentById,
    rootIds: childrenByParentId[ROOT_PARENT_ID] ?? [],
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

  for (const [key, childIds] of Object.entries(snapshot.childrenByParentId)) {
    const parentId = key === ROOT_PARENT_ID ? null : key;
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
  const thread: UM[] = [];
  let currentMessageId: string | null = leafMessageId;
  let iteration = 0;

  while (currentMessageId) {
    iteration += 1;
    if (iteration > 100) {
      break;
    }

    const currentMessage = messagesById.get(currentMessageId);
    if (!currentMessage) {
      break;
    }

    thread.unshift(currentMessage);
    currentMessageId = snapshot.parentById[currentMessageId] ?? null;
  }

  return thread;
}

function findLeafDfsToRightFromSnapshot<UM extends UIMessage>(
  snapshot: MessageTreeSnapshot<UM>,
  messageId: string
): string | null {
  const children = snapshot.childrenByParentId[messageId] ?? [];
  const rightmostChild = children.at(-1);

  if (!rightmostChild) {
    return null;
  }

  return (
    findLeafDfsToRightFromSnapshot(snapshot, rightmostChild) ?? rightmostChild
  );
}

function getSnapshotSignature<UM extends UIMessage>(
  snapshot: MessageTreeSnapshot<UM>
) {
  return JSON.stringify({
    childrenByParentId: snapshot.childrenByParentId,
    cursorId: snapshot.cursorId,
    messagesById: snapshot.messagesById,
    parentById: snapshot.parentById,
    rootIds: snapshot.rootIds,
  });
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
  parentById: Record<string, string | null>
) {
  for (const [messageId, message] of merged) {
    if ((message as UM & MessageNode).metadata !== undefined) {
      continue;
    }

    const parentId = parentById[messageId] ?? null;
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
        createdAt: new Date(),
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
      parentById: Record<string, string | null> = {}
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

    return {
      ...base,
      threadEpoch: 0,
      threadInitialMessages: base.messages,
      allMessages: base.messages,
      treeSnapshot: buildTreeSnapshotFromMessages(base.messages),
      treeSnapshotSignature: getSnapshotSignature(
        buildTreeSnapshotFromMessages(base.messages)
      ),
      childrenMap: rebuildMap(base.messages),

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
        set((state) => {
          const snapshot = buildTreeSnapshotFromMessages(
            state.allMessages,
            cursorId
          );
          state._messageIndex.update(messages);
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
        const snapshotMessages = Object.values(snapshot.messagesById);
        const mergedMessages = mergeTreeMessages(
          snapshotMessages,
          state.allMessages,
          [],
          snapshot.parentById
        );
        const mergedSnapshot = buildTreeSnapshotFromMessages(
          mergedMessages,
          snapshot.cursorId
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

        set((prev) => {
          prev._messageIndex.update(nextVisibleThread);
          return {
            ...prev,
            messages: nextVisibleThread,
            _memoizedSelectors: new Map(),
            _throttledMessages: nextVisibleThread,
            allMessages: mergedMessages,
            treeSnapshot: mergedSnapshot,
            treeSnapshotSignature: signature,
            childrenMap: rebuildMap(mergedMessages, mergedSnapshot),
          };
        });
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
        const snapshot = buildTreeSnapshotFromMessages(
          mergedMessages,
          currentVisibleMessages.at(-1)?.id ?? null
        );

        // While the SDK is actively streaming, updating the visible thread with
        // server data would mix the SDK's client-generated message ID with the
        // server's assistantMessageId. The mismatch causes the SDK to push a
        // second assistant message on the next chunk, bumping the epoch and
        // remounting ChatSync mid-stream. Only update the tree index here and
        // let the normal post-stream invalidation apply the full visible update.
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
        const nextVisibleThread = currentLeafId
          ? buildThreadFromSnapshot(mergedMessages, snapshot, currentLeafId)
          : currentVisibleMessages;

        originalSetMessages(nextVisibleThread);
        set((prev) => ({
          ...prev,
          messages: nextVisibleThread,
          _memoizedSelectors: new Map(),
          _throttledMessages: nextVisibleThread,
          threadInitialMessages: nextVisibleThread,
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

        const parentId =
          state.treeSnapshot.parentById[message.id] ??
          getMetadataParentId(message);
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
            : (state.treeSnapshot.parentById[message.id] ??
              metadata?.parentMessageId ??
              null);

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

        if (groupMessages.length <= 1) {
          return null;
        }

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
