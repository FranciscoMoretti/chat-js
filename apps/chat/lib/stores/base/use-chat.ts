// biome-ignore-all lint: vendored chat store base.

import {
  type UIMessage,
  type UseChatHelpers,
  type UseChatOptions,
} from "@ai-sdk/react";
import { type MessageTreeSnapshot, type ThreadInit } from "@chatjs/thread";
import {
  type UseThreadHelpers,
  type UseThreadOptions,
  useThread as useOriginalChat,
} from "@chatjs/thread/react";
import type { ChatInit } from "ai";
import { useCallback, useEffect, useRef } from "react";
import { type StoreState, useChatStoreApi } from "./hooks";

export type {
  UseChatHelpers,
  UseChatOptions,
  UseThreadHelpers,
  UseThreadOptions,
};

// Type for a compatible chat store
type CompatibleChatStoreState<TMessage extends UIMessage> =
  StoreState<TMessage> & {
    setTreeSnapshot?: (snapshot: MessageTreeSnapshot<TMessage>) => void;
    treeSnapshot?: MessageTreeSnapshot<TMessage>;
  };

export interface CompatibleChatStore<TMessage extends UIMessage = UIMessage> {
  getState: () => CompatibleChatStoreState<TMessage>;
}

export type UseChatOptionsWithPerformance<
  TMessage extends UIMessage = UIMessage,
> = ChatInit<TMessage> & {
  experimental_throttle?: number;
  resume?: boolean;
} & Pick<ThreadInit<TMessage>, "concurrency" | "initialTree"> & {
    store?: CompatibleChatStore<TMessage>;
    // Additional performance options
    enableBatching?: boolean;
  };

function getInitialTree<TMessage extends UIMessage>(
  store: CompatibleChatStore<TMessage>,
  fallbackMessages: TMessage[] | undefined,
  explicitInitialTree: MessageTreeSnapshot<TMessage> | undefined
) {
  if (explicitInitialTree) {
    return explicitInitialTree;
  }

  const state = store.getState();
  const messages = fallbackMessages ?? [];

  return (
    state.treeSnapshot ??
    ({
      cursorId: messages.at(-1)?.id ?? null,
      nodes: messages.map((message, index, allMessages) => ({
        message,
        parentId: index === 0 ? null : (allMessages[index - 1]?.id ?? null),
      })),
      version: 1,
    } satisfies MessageTreeSnapshot<TMessage>)
  );
}

function treeSignature<TMessage extends UIMessage>(
  snapshot: MessageTreeSnapshot<TMessage>
) {
  return JSON.stringify(snapshot);
}

export function useChat<TMessage extends UIMessage = UIMessage>(
  options: UseChatOptionsWithPerformance<TMessage> = {}
): UseThreadHelpers<TMessage> {
  const {
    store: customStore,
    enableBatching = true,
    initialTree,
    messages: externalMessages,
    ...originalOptions
  } = options;

  const originalOnData = options.onData;

  // Use custom store if provided, otherwise use the context store
  const contextStore = useChatStoreApi<TMessage>();
  const store: CompatibleChatStore<TMessage> = customStore ?? contextStore;
  const initialTreeRef = useRef<MessageTreeSnapshot<TMessage> | undefined>(
    undefined
  );
  if (!initialTreeRef.current) {
    initialTreeRef.current = getInitialTree(
      store,
      externalMessages,
      initialTree
    );
  }

  // Wrap onData to capture transient data parts
  const wrappedOnData = useCallback<NonNullable<ChatInit<TMessage>["onData"]>>(
    (dataPart) => {
      // Check if it's a data part (starts with 'data-')
      if (dataPart.type?.startsWith("data-")) {
        // Store transient data parts in the store
        const storeState = store.getState();
        // If data is null or undefined, remove the transient data part
        if (dataPart.data === null || dataPart.data === undefined) {
          storeState.removeTransientDataPart(dataPart.type);
        } else {
          storeState.setTransientDataPart(dataPart.type, dataPart.data);
        }
      }

      // Call original onData handler if provided
      if (originalOnData) {
        originalOnData(dataPart);
      }
    },
    [store, originalOnData]
  );

  const chatHelpers = useOriginalChat<TMessage>({
    ...originalOptions,
    initialTree: initialTreeRef.current,
    onData: wrappedOnData,
  });
  const currentTreeSnapshot = chatHelpers.tree.getSnapshot();
  const currentTreeSignature = treeSignature(currentTreeSnapshot);
  const currentTreeSnapshotRef = useRef(currentTreeSnapshot);
  currentTreeSnapshotRef.current = currentTreeSnapshot;

  const storeRef = useRef<CompatibleChatStore<TMessage>>(store);

  const lastSyncedStateRef = useRef<string | null>(null);
  const lastSyncedTreeRef = useRef<string | null>(null);

  // Memoize the sync function to avoid recreating it on every render
  const syncState = useCallback((chatState: Partial<StoreState<TMessage>>) => {
    if (!storeRef.current) {
      return;
    }

    storeRef.current.getState()._syncState(chatState);
  }, []);

  const setMessages = useCallback<UseThreadHelpers<TMessage>["setMessages"]>(
    (messagesOrUpdater) => {
      const currentMessages = store.getState().messages ?? chatHelpers.messages;
      const nextMessages =
        typeof messagesOrUpdater === "function"
          ? messagesOrUpdater(currentMessages)
          : messagesOrUpdater;

      chatHelpers.setMessages(nextMessages);
    },
    [chatHelpers.messages, chatHelpers.setMessages, store]
  );

  // Simple sync - but don't overwrite store messages if chat has no messages
  // This preserves server-side messages during hydration
  useEffect(() => {
    // Only sync state data
    const stateData: Partial<StoreState<TMessage>> = {
      id: chatHelpers.id,
      error: chatHelpers.error,
      status: chatHelpers.status,
    };

    // Sync functions separately and only once
    const functionsData = {
      sendMessage: chatHelpers.sendMessage,
      startRun: chatHelpers.tree.startRun,
      regenerate: chatHelpers.regenerate,
      stop: chatHelpers.stop,
      resumeStream: chatHelpers.resumeStream,
      addToolResult: chatHelpers.addToolResult,
      setMessages,
      clearError: chatHelpers.clearError,
    };

    const chatState = { ...stateData, ...functionsData };
    const syncSignature = JSON.stringify({
      error: chatHelpers.error?.message,
      id: chatHelpers.id,
      status: chatHelpers.status,
    });

    if (lastSyncedStateRef.current !== syncSignature) {
      lastSyncedStateRef.current = syncSignature;

      if (enableBatching) {
        // Use requestAnimationFrame for batching if available
        if (
          typeof window !== "undefined" &&
          typeof window.requestAnimationFrame === "function"
        ) {
          window.requestAnimationFrame(() => {
            syncState(chatState);
          });
        } else {
          syncState(chatState);
        }
      } else {
        syncState(chatState);
      }
    }

    const setTreeSnapshot = store.getState().setTreeSnapshot;
    if (typeof setTreeSnapshot === "function") {
      if (lastSyncedTreeRef.current !== currentTreeSignature) {
        lastSyncedTreeRef.current = currentTreeSignature;
        setTreeSnapshot(currentTreeSnapshotRef.current);
      }
    }
  }, [
    // Only depend on data that actually changes, not function references
    chatHelpers.id,
    chatHelpers.messages,
    chatHelpers.error,
    chatHelpers.status,
    syncState,
    enableBatching,
    chatHelpers.resumeStream,
    chatHelpers.clearError,
    chatHelpers.sendMessage,
    chatHelpers.tree.startRun,
    store,
    setMessages,
    chatHelpers.stop,
    chatHelpers.regenerate,
    chatHelpers.addToolResult,
    currentTreeSignature,
  ]);

  return {
    ...chatHelpers,
    setMessages,
    messages: chatHelpers.messages,
  };
}
