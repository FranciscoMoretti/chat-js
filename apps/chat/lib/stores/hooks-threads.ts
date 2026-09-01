import type { ThreadRun } from "@chatjs/thread";
import { useCallback } from "react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { ChatMessage } from "../ai/types";
import {
  type CustomChatStoreState,
  useApplicationThread,
  useCustomChatStoreApi,
} from "./custom-store-provider";

export interface MessageSiblingInfo {
  siblingIndex: number;
  siblings: ChatMessage[];
}

export interface ParallelGroupInfo {
  messages: ChatMessage[];
  parallelGroupId: string;
  runsByParallelIndex: Record<number, ThreadRun>;
  selectedMessageId: string | null;
}

export const useAddMessageToTree = () => {
  const thread = useApplicationThread();
  return useCallback(
    (message: ChatMessage) =>
      thread.upsertMessage(message, message.metadata.parentMessageId),
    [thread]
  );
};

function useThreadStore<T>(
  selector: (store: CustomChatStoreState<ChatMessage>) => T,
  equalityFn?: (a: T, b: T) => boolean
): T {
  const store = useCustomChatStoreApi<ChatMessage>();
  return useStoreWithEqualityFn(store, selector, equalityFn);
}

function getSiblingInfo(
  state: CustomChatStoreState<ChatMessage>,
  messageId: string
): MessageSiblingInfo | null {
  const { childrenByParentId, messagesById, parentById, rootIds } =
    state.threadSnapshot;
  if (!messagesById[messageId]) {
    return null;
  }

  const parentId = parentById[messageId] ?? null;
  const siblingIds =
    parentId === null ? rootIds : (childrenByParentId[parentId] ?? []);
  const siblings = siblingIds.flatMap((id) => {
    const message = messagesById[id];
    return message ? [message] : [];
  });

  return {
    siblingIndex: siblingIds.indexOf(messageId),
    siblings,
  };
}

export function useMessageSiblingInfo(
  messageId: string
): MessageSiblingInfo | null {
  return useThreadStore(
    (state) => getSiblingInfo(state, messageId),
    (a, b) =>
      a === b ||
      (a !== null &&
        b !== null &&
        a.siblingIndex === b.siblingIndex &&
        a.siblings.length === b.siblings.length &&
        a.siblings.every(
          (sibling, index) => sibling.id === b.siblings[index]?.id
        ))
  );
}

export const useSwitchToSibling = () => {
  const thread = useApplicationThread();

  return useCallback(
    (messageId: string, direction: "prev" | "next") => {
      const siblings = thread.getSiblings(messageId);
      if (siblings.length <= 1) {
        return null;
      }

      const currentIndex = siblings.findIndex(({ id }) => id === messageId);
      if (currentIndex === -1) {
        return null;
      }
      const offset = direction === "next" ? 1 : -1;
      const nextIndex = currentIndex + offset;
      if (nextIndex < 0 || nextIndex >= siblings.length) {
        return null;
      }
      const target = siblings[nextIndex];
      const leaf = thread.getLeaves(target.id).at(-1) ?? target;
      thread.setCursor(leaf.id);
      return thread.getSnapshot().messages;
    },
    [thread]
  );
};

export function useParallelGroupInfo(
  messageId: string
): ParallelGroupInfo | null {
  return useThreadStore(
    (state) => {
      const snapshot = state.threadSnapshot;
      const message = snapshot.messagesById[messageId];
      const parallelGroupId = message?.metadata.parallelGroupId ?? null;
      let parentId: string | null = null;
      if (message?.role === "user") {
        parentId = message.id;
      } else if (message) {
        parentId = snapshot.parentById[message.id] ?? null;
      }
      if (!(parentId && parallelGroupId)) {
        return null;
      }

      const messages = (snapshot.childrenByParentId[parentId] ?? [])
        .flatMap((id) => {
          const candidate = snapshot.messagesById[id];
          return candidate ? [candidate] : [];
        })
        .filter(
          (candidate) => candidate.metadata.parallelGroupId === parallelGroupId
        )
        .sort(
          (a, b) =>
            (a.metadata.parallelIndex ?? Number.MAX_SAFE_INTEGER) -
            (b.metadata.parallelIndex ?? Number.MAX_SAFE_INTEGER)
        );
      const visibleIds = new Set(snapshot.messages.map(({ id }) => id));
      const runsById = new Map(snapshot.runs.map((run) => [run.id, run]));
      const runsByParallelIndex: Record<number, ThreadRun> = {};
      const runIdsByParallelIndex =
        state.parallelRunIdsByGroup[parallelGroupId] ?? {};
      for (const [parallelIndex, runId] of Object.entries(
        runIdsByParallelIndex
      )) {
        const run = runsById.get(runId);
        if (run) {
          runsByParallelIndex[Number(parallelIndex)] = run;
        }
      }

      return {
        messages,
        parallelGroupId,
        runsByParallelIndex,
        selectedMessageId:
          messages.find(({ id }) => visibleIds.has(id))?.id ?? null,
      };
    },
    (a, b) =>
      a === b ||
      (a !== null &&
        b !== null &&
        a.parallelGroupId === b.parallelGroupId &&
        a.selectedMessageId === b.selectedMessageId &&
        Object.keys(a.runsByParallelIndex).length ===
          Object.keys(b.runsByParallelIndex).length &&
        Object.entries(a.runsByParallelIndex).every(([parallelIndex, run]) => {
          const other = b.runsByParallelIndex[Number(parallelIndex)];
          return (
            run.id === other?.id &&
            run.status === other.status &&
            run.error === other.error
          );
        }) &&
        a.messages.length === b.messages.length &&
        a.messages.every(
          (message, index) =>
            message.id === b.messages[index]?.id &&
            message.metadata.activeStreamId ===
              b.messages[index]?.metadata.activeStreamId
        ))
  );
}

export const useSwitchToMessage = () => {
  const thread = useApplicationThread();

  return useCallback(
    (messageId: string) => {
      const message = thread.getMessage(messageId);
      if (!message) {
        return null;
      }
      const leaf = thread.getLeaves(messageId).at(-1) ?? message;
      thread.setCursor(leaf.id);
      return thread.getSnapshot().messages;
    },
    [thread]
  );
};
