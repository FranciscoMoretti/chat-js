// biome-ignore-all lint: vendored chat store base.

import {
  type UIMessage,
  type UseChatHelpers,
  type UseChatOptions,
} from "@ai-sdk/react";
import { type AbstractThread, type MessageTreeSnapshot } from "@chatjs/thread";
import {
  type UseThreadHelpers,
  type UseThreadOptions,
  useThread as useOriginalChat,
} from "@chatjs/thread/react";
import type { ChatInit } from "ai";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
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
    threadSnapshot?: MessageTreeSnapshot<TMessage>;
  };

export interface CompatibleChatStore<TMessage extends UIMessage = UIMessage> {
  getState: () => CompatibleChatStoreState<TMessage>;
}

export type UseChatOptionsWithPerformance<
  TMessage extends UIMessage = UIMessage,
> = Pick<
  ChatInit<TMessage>,
  | "onData"
  | "onError"
  | "onFinish"
  | "onToolCall"
  | "sendAutomaticallyWhen"
  | "transport"
> & {
  experimental_throttle?: number;
  resume?: boolean;
  store?: CompatibleChatStore<TMessage>;
  thread: AbstractThread<TMessage>;
  // Additional performance options
  enableBatching?: boolean;
};

export function useChat<TMessage extends UIMessage = UIMessage>(
  options: UseChatOptionsWithPerformance<TMessage>
): UseThreadHelpers<TMessage> {
  const {
    store: customStore,
    enableBatching = true,
    experimental_throttle,
    onData,
    onError,
    onFinish,
    onToolCall,
    resume,
    sendAutomaticallyWhen,
    thread,
    transport,
  } = options;

  // Use custom store if provided, otherwise use the context store
  const contextStore = useChatStoreApi<TMessage>();
  const store: CompatibleChatStore<TMessage> = customStore ?? contextStore;

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
      onData?.(dataPart);
    },
    [store, onData]
  );

  useLayoutEffect(() => {
    const previous = {
      onData: thread.onData,
      onError: thread.onError,
      onFinish: thread.onFinish,
      onToolCall: thread.onToolCall,
      sendAutomaticallyWhen: thread.sendAutomaticallyWhen,
      transport: thread.transport,
    };

    thread.onData = wrappedOnData;
    thread.onError = onError;
    thread.onFinish = onFinish;
    thread.onToolCall = onToolCall;
    thread.sendAutomaticallyWhen = sendAutomaticallyWhen;
    if (transport) {
      thread.transport = transport;
    }

    return () => {
      if (thread.onData === wrappedOnData) thread.onData = previous.onData;
      if (thread.onError === onError) thread.onError = previous.onError;
      if (thread.onFinish === onFinish) thread.onFinish = previous.onFinish;
      if (thread.onToolCall === onToolCall) {
        thread.onToolCall = previous.onToolCall;
      }
      if (thread.sendAutomaticallyWhen === sendAutomaticallyWhen) {
        thread.sendAutomaticallyWhen = previous.sendAutomaticallyWhen;
      }
      if (transport && thread.transport === transport) {
        thread.transport = previous.transport;
      }
    };
  }, [
    onError,
    onFinish,
    onToolCall,
    sendAutomaticallyWhen,
    thread,
    transport,
    wrappedOnData,
  ]);

  const chatHelpers = useOriginalChat<TMessage>({
    experimental_throttle,
    resume,
    thread,
  });

  const storeRef = useRef<CompatibleChatStore<TMessage>>(store);
  storeRef.current = store;

  // Memoize the sync function to avoid recreating it on every render
  const syncState = useCallback(
    (chatState: Parameters<StoreState<TMessage>["_syncState"]>[0]) => {
      if (!storeRef.current) {
        return;
      }

      storeRef.current.getState()._syncState(chatState);
    },
    []
  );

  // Keep imperative helpers available to legacy store consumers. Observable
  // chat state is projected atomically by the Zustand ThreadState adapter.
  useEffect(() => {
    // Only sync state data
    const stateData: Parameters<StoreState<TMessage>["_syncState"]>[0] = {
      id: chatHelpers.id,
    };

    // Sync functions separately and only once
    const functionsData = {
      sendMessage: chatHelpers.sendMessage,
      startRun: chatHelpers.tree.startRun,
      regenerate: chatHelpers.regenerate,
      stop: chatHelpers.stop,
      resumeStream: chatHelpers.resumeStream,
      addToolResult: chatHelpers.addToolResult,
      setMessages: chatHelpers.setMessages,
      clearError: chatHelpers.clearError,
    };

    const chatState = { ...stateData, ...functionsData };

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
  }, [
    // Only depend on data that actually changes, not function references
    chatHelpers.id,
    syncState,
    enableBatching,
    chatHelpers.resumeStream,
    chatHelpers.clearError,
    chatHelpers.sendMessage,
    chatHelpers.tree.startRun,
    store,
    chatHelpers.setMessages,
    chatHelpers.stop,
    chatHelpers.regenerate,
    chatHelpers.addToolResult,
  ]);

  return chatHelpers;
}
