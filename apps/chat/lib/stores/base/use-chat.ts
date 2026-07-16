// biome-ignore-all lint: vendored chat store base.

import {
  type UIMessage,
  type UseChatHelpers,
  type UseChatOptions,
} from "@ai-sdk/react";
import {
  type MessageTreeSnapshot,
  ROOT_PARENT_ID,
  type ThreadChatOptions,
} from "@chatjs/thread";
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
export interface CompatibleChatStore<TMessage extends UIMessage = UIMessage> {
  _syncState?: (partial: Partial<StoreState<TMessage>>) => void;
  setState?: (partial: Partial<StoreState<TMessage>>) => void;
  <T>(selector: (state: StoreState<TMessage>) => T): T;
}

export type UseChatOptionsWithPerformance<
  TMessage extends UIMessage = UIMessage,
> = ChatInit<TMessage> & {
  experimental_throttle?: number;
  resume?: boolean;
} & Pick<ThreadChatOptions<TMessage>, "concurrency" | "initialTree"> & {
    store?: CompatibleChatStore<TMessage>;
    // Additional performance options
    enableBatching?: boolean;
  };

function getInitialTree<TMessage extends UIMessage>(
  store: CompatibleChatStore<TMessage> | { getState?: () => any },
  fallbackMessages: TMessage[] | undefined,
  explicitInitialTree: MessageTreeSnapshot<TMessage> | undefined
) {
  if (explicitInitialTree) {
    return explicitInitialTree;
  }

  const state = (store as any).getState?.();
  const messages = fallbackMessages ?? [];
  const childrenByParentId = Object.fromEntries(
    messages.map((message, index, allMessages) => [
      index === 0 ? ROOT_PARENT_ID : allMessages[index - 1]?.id,
      [message.id],
    ])
  );

  return (
    (state?.treeSnapshot as MessageTreeSnapshot<TMessage> | undefined) ??
    ({
      childrenByParentId,
      cursorId: messages.at(-1)?.id ?? null,
      messagesById: Object.fromEntries(
        messages.map((message) => [message.id, message])
      ),
      parentById: Object.fromEntries(
        messages.map((message, index, allMessages) => [
          message.id,
          index === 0 ? null : allMessages[index - 1]?.id,
        ])
      ),
      rootIds: messages[0] ? [messages[0].id] : [],
      version: 1,
    } satisfies MessageTreeSnapshot<TMessage>)
  );
}

function messagesSignature<TMessage extends UIMessage>(messages: TMessage[]) {
  return JSON.stringify(messages);
}

function treeSignature<TMessage extends UIMessage>(
  snapshot: MessageTreeSnapshot<TMessage>
) {
  return JSON.stringify({
    childrenByParentId: snapshot.childrenByParentId,
    cursorId: snapshot.cursorId,
    messagesById: snapshot.messagesById,
    parentById: snapshot.parentById,
    rootIds: snapshot.rootIds,
  });
}

export function useChat<TMessage extends UIMessage = UIMessage>(
  options: UseChatOptionsWithPerformance<TMessage> = {} as UseChatOptionsWithPerformance<TMessage>
): UseThreadHelpers<TMessage> {
  const {
    store: customStore,
    enableBatching = true,
    initialTree,
    ...originalOptions
  } = options;

  const originalOnData = (options as any).onData;
  const externalMessages = (originalOptions as any).messages as
    | TMessage[]
    | undefined;

  // Use custom store if provided, otherwise use the context store
  const contextStore = useChatStoreApi<TMessage>();
  const store = customStore || contextStore;
  const initialTreeRef = useRef<MessageTreeSnapshot<TMessage> | null>(null);
  if (!initialTreeRef.current) {
    initialTreeRef.current = getInitialTree(
      store,
      (originalOptions as any).messages as TMessage[] | undefined,
      initialTree
    );
  }

  // Wrap onData to capture transient data parts
  const wrappedOnData = useCallback(
    (dataPart: any) => {
      // Check if it's a data part (starts with 'data-')
      if (dataPart.type?.startsWith("data-")) {
        // Store transient data parts in the store
        if (typeof (store as any).getState === "function") {
          const storeState = (store as any).getState();
          // If data is null or undefined, remove the transient data part
          if (dataPart.data === null || dataPart.data === undefined) {
            if (storeState.removeTransientDataPart) {
              storeState.removeTransientDataPart(dataPart.type);
            }
          } else if (storeState.setTransientDataPart) {
            storeState.setTransientDataPart(dataPart.type, dataPart.data);
          }
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
  }) as UseThreadHelpers<TMessage>;

  const storeRef = useRef<CompatibleChatStore<TMessage> | typeof contextStore>(
    store
  );

  const lastSyncedStateRef = useRef<string | null>(null);
  const lastSyncedTreeRef = useRef<string | null>(null);
  const lastExternalMessagesRef = useRef<string | null>(
    externalMessages ? messagesSignature(externalMessages) : null
  );

  // Memoize the sync function to avoid recreating it on every render
  const syncState = useCallback((chatState: Partial<StoreState<TMessage>>) => {
    if (!storeRef.current) {
      return;
    }

    // Check if store has _syncState method (our internal stores)
    if (typeof (storeRef.current as any).getState === "function") {
      // For vanilla Zustand stores
      const vanillaStore = storeRef.current as any;
      vanillaStore.getState()._syncState(chatState);
    } else if (typeof (storeRef.current as any)._syncState === "function") {
      (storeRef.current as any)._syncState(chatState);
    } else if (typeof (storeRef.current as any).setState === "function") {
      // For standard Zustand stores
      (storeRef.current as any).setState(chatState);
    }
  }, []);

  const setMessages = useCallback<UseThreadHelpers<TMessage>["setMessages"]>(
    (messagesOrUpdater) => {
      const currentMessages =
        ((store as any).getState?.().messages as TMessage[] | undefined) ??
        chatHelpers.messages;
      const nextMessages =
        typeof messagesOrUpdater === "function"
          ? messagesOrUpdater(currentMessages)
          : messagesOrUpdater;

      chatHelpers.setMessages(nextMessages);
    },
    [chatHelpers.messages, chatHelpers.setMessages, store]
  );

  useEffect(() => {
    if (!externalMessages) {
      return;
    }

    const externalSignature = messagesSignature(externalMessages);
    if (lastExternalMessagesRef.current === externalSignature) {
      return;
    }

    lastExternalMessagesRef.current = externalSignature;
    if (messagesSignature(chatHelpers.messages) !== externalSignature) {
      setMessages(externalMessages);
    }
  }, [externalMessages, chatHelpers.messages, setMessages]);

  // Simple sync - but don't overwrite store messages if chat has no messages
  // This preserves server-side messages during hydration
  useEffect(() => {
    // Only sync state data
    const stateData: any = {
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

    const setTreeSnapshot = (store as any).getState?.().setTreeSnapshot;
    if (typeof setTreeSnapshot === "function") {
      const snapshot = chatHelpers.tree.getSnapshot();
      const signature = treeSignature(snapshot);

      if (lastSyncedTreeRef.current !== signature) {
        lastSyncedTreeRef.current = signature;
        setTreeSnapshot(snapshot);
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
  ]);

  return {
    ...chatHelpers,
    setMessages,
    messages: chatHelpers.messages,
  };
}
