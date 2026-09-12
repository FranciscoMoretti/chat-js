"use client";

import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";
import type { UseThreadHelpers } from "@chat-js/thread/react";
import type { ChatStatus } from "ai";
import * as React from "react";
import { createContext, useCallback, useContext, useRef } from "react";
import { useStore } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import { createStore } from "zustand/vanilla";
import type { StateCreator, StoreApi } from "zustand/vanilla";

import { debug } from "./debug";

// --- Performance monitoring and batching ---
let __freezeDetectorStarted = false;
let __freezeRafId = 0;
let __freezeLastTs = 0;
let __lastActionLabel: string | undefined;
let __clearLastActionTimer: ReturnType<typeof setTimeout> | null = null;

// Batched updates queue with priority
const __updateQueue: { callback: () => void; priority: number }[] = [];
let __batchedUpdateScheduled = false;

const markLastAction = (label: string) => {
  __lastActionLabel = label;
  if (typeof window !== "undefined") {
    if (__clearLastActionTimer) {
      clearTimeout(__clearLastActionTimer);
    }
    __clearLastActionTimer = setTimeout(() => {
      if (__lastActionLabel === label) {
        __lastActionLabel = undefined;
      }
    }, 250);
  }
};

const batchUpdates = (callback: () => void, priority = 0) => {
  if (typeof window === "undefined") {
    callback();
    return;
  }

  __updateQueue.push({ callback, priority });

  if (!__batchedUpdateScheduled) {
    __batchedUpdateScheduled = true;

    // Use scheduler if available, otherwise fallback to rAF
    const { scheduler } = window as Window & {
      scheduler?: { postTask?: (callback: () => void) => void };
    };
    const schedule = scheduler?.postTask
      ? scheduler.postTask.bind(scheduler)
      : window.requestAnimationFrame?.bind(window) ||
        ((fn: () => void) => setTimeout(fn, 0));

    schedule(() => {
      const updates = __updateQueue.splice(0);
      __batchedUpdateScheduled = false;

      // Sort by priority (higher priority first) and execute
      updates.sort((a, b) => b.priority - a.priority);
      for (const update of updates) {
        update.callback();
      }
    });
  }
};

const startFreezeDetector = ({
  thresholdMs = 80,
}: {
  thresholdMs?: number;
} = {}): void => {
  if (typeof window === "undefined" || __freezeDetectorStarted) {
    return;
  }
  __freezeDetectorStarted = true;
  __freezeLastTs = performance.now();

  const tick = (now: number) => {
    const expected = __freezeLastTs + 16.7;
    const blockedMs = now - expected;
    if (blockedMs > thresholdMs) {
      debug.warn(
        "[Freeze]",
        `${Math.round(blockedMs)}ms`,
        "lastAction=",
        __lastActionLabel
      );
    }
    __freezeLastTs = now;
    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      __freezeRafId = window.requestAnimationFrame(tick);
    }
  };

  if (
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function"
  ) {
    __freezeRafId = window.requestAnimationFrame(tick);
  }

  if (
    typeof window !== "undefined" &&
    typeof window.addEventListener === "function"
  ) {
    window.addEventListener("beforeunload", () => {
      if (__freezeRafId && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(__freezeRafId);
      }
    });
  }
};

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  startFreezeDetector({ thresholdMs: 80 });
}

// Enhanced throttle with requestIdleCallback support
const enhancedThrottle = <T extends (...args: never[]) => void>(
  func: T,
  wait: number
): T => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let previous = 0;
  let pendingArgs: Parameters<T> | null = null;

  const execute = () => {
    if (pendingArgs) {
      func(...pendingArgs);
      pendingArgs = null;
    }
  };

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - previous);
    pendingArgs = args;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;

      execute();
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;

        if (typeof window !== "undefined" && window.requestIdleCallback) {
          window.requestIdleCallback(execute, { timeout: 50 });
        } else {
          execute();
        }
      }, remaining);
    }
  }) as T;
};

// Message indexing for O(1) lookups
class MessageIndex<TMessage extends UIMessage> {
  private idToMessage = new Map<string, TMessage>();
  private idToIndex = new Map<string, number>();

  update(messages: TMessage[]) {
    this.idToMessage.clear();
    this.idToIndex.clear();

    for (const [index, message] of messages.entries()) {
      this.idToMessage.set(message.id, message);
      this.idToIndex.set(message.id, index);
    }
  }

  getById(id: string): TMessage | undefined {
    return this.idToMessage.get(id);
  }

  getIndexById(id: string): number | undefined {
    return this.idToIndex.get(id);
  }

  has(id: string): boolean {
    return this.idToMessage.has(id);
  }
}

type SyncedChatState<TMessage extends UIMessage> = Partial<
  Pick<
    StoreState<TMessage>,
    | "addToolResult"
    | "clearError"
    | "id"
    | "regenerate"
    | "resumeStream"
    | "sendMessage"
    | "setMessages"
    | "startRun"
    | "stop"
  >
>;

export interface StoreState<TMessage extends UIMessage = UIMessage> {
  _messageIndex: MessageIndex<TMessage>;

  // Performance optimizations
  _scheduleThrottledMessagesUpdate: () => void;

  // Internal sync method
  _syncState: (newState: SyncedChatState<TMessage>) => void;
  _throttledMessages: TMessage[] | null;

  // Transient data parts (not persisted in messages)
  _transientDataParts: Map<string, unknown>;
  addToolResult?: UseChatHelpers<TMessage>["addToolResult"];
  clearError?: UseChatHelpers<TMessage>["clearError"];
  clearTransientDataParts: () => void;
  error: Error | undefined;
  getInternalMessages: () => TMessage[];

  // Optimized getters
  getLastMessageId: () => string | null;

  getMessageById: (id: string) => TMessage | undefined;
  getMessageCount: () => number;
  getMessageIds: () => string[];
  getMessageIndexById: (id: string) => number | undefined;
  getMessagesSlice: (start: number, end?: number) => TMessage[];
  getThrottledMessages: () => TMessage[];
  getTransientDataPart: (type: string) => unknown;
  id: string | undefined;
  messages: TMessage[];
  popMessage: () => void;
  pushMessage: (message: TMessage) => void;
  regenerate?: UseChatHelpers<TMessage>["regenerate"];

  // Effects
  registerThrottledMessagesEffect: (effect: () => void) => () => void;
  removeTransientDataPart: (type: string) => void;
  replaceMessage: (index: number, message: TMessage) => void;
  replaceMessageById: (id: string, message: TMessage) => void;

  // Reset method
  reset: () => void;
  resumeStream?: UseChatHelpers<TMessage>["resumeStream"];

  // Chat helpers
  sendMessage?: UseChatHelpers<TMessage>["sendMessage"];
  setError: (error: Error | undefined) => void;

  // Actions with batching
  setId: (id: string | undefined) => void;
  setMessages: (messages: TMessage[]) => void;
  setNewChat: (id: string, messages: TMessage[]) => void;
  setStatus: (status: ChatStatus) => void;

  // Transient data methods
  setTransientDataPart: (type: string, data: unknown) => void;
  startRun?: UseThreadHelpers<TMessage>["tree"]["startRun"];
  status: ChatStatus;
  stop?: UseChatHelpers<TMessage>["stop"];
}

// ~60fps for smooth streaming
const MESSAGES_THROTTLE_MS = 16;

export const createChatStoreCreator = <TMessage extends UIMessage>(
  initialMessages: TMessage[] = []
): StateCreator<StoreState<TMessage>, [], []> => {
  let throttledMessagesUpdater: (() => void) | null = null;
  const messageIndex = new MessageIndex<TMessage>();
  const throttledEffects = new Set<() => void>();

  messageIndex.update(initialMessages);
  return (set, get) => {
    if (!throttledMessagesUpdater) {
      throttledMessagesUpdater = enhancedThrottle(() => {
        batchUpdates(() => {
          const state = get();
          const newThrottledMessages = [...state.messages];
          state._messageIndex.update(newThrottledMessages);

          set({
            _throttledMessages: newThrottledMessages,
          });

          for (const cb of throttledEffects) {
            try {
              cb();
            } catch (error) {
              debug.warn("[chat-store-base] throttled effect error", error);
            }
          }
        });
      }, MESSAGES_THROTTLE_MS);
    }

    return {
      id: undefined,
      messages: initialMessages,
      status: "ready" as const,
      error: undefined,
      _throttledMessages: [...initialMessages],
      _messageIndex: messageIndex,
      _transientDataParts: new Map(),
      _scheduleThrottledMessagesUpdate: () => {
        throttledMessagesUpdater?.();
      },

      // Chat helpers
      sendMessage: undefined,
      startRun: undefined,
      regenerate: undefined,
      stop: undefined,
      resumeStream: undefined,
      addToolResult: undefined,
      clearError: undefined,

      setId: (id) => {
        markLastAction("chat:setId");
        batchUpdates(() => set({ id }));
      },

      setMessages: (messages) => {
        markLastAction("chat:setMessages");
        batchUpdates(() => {
          // Avoid unnecessary work if messages haven't changed
          const currentState = get();
          if (messages === currentState.messages) {
            return;
          }

          currentState._messageIndex.update(messages);
          set({
            messages,
            // Clear memoized selectors
          });

          // During streaming, update immediately for smooth text rendering
          if (currentState.status === "streaming") {
            // High priority for streaming updates
            batchUpdates(() => {
              const state = get();
              const newThrottledMessages = [...state.messages];
              state._messageIndex.update(newThrottledMessages);

              set({
                _throttledMessages: newThrottledMessages,
              });
            }, 1);
          } else {
            throttledMessagesUpdater?.();
          }
        });
      },

      setStatus: (status) => {
        markLastAction("chat:setStatus");
        batchUpdates(() => set({ status }));
      },

      setError: (error) => {
        markLastAction("chat:setError");
        batchUpdates(() => set({ error }));
      },

      setNewChat: (id, messages) => {
        markLastAction("chat:setNewChat");
        batchUpdates(() => {
          get()._messageIndex.update(messages);
          set({
            error: undefined,
            id,
            messages,
            status: "ready",
          });
          throttledMessagesUpdater?.();
        });
      },

      pushMessage: (message) => {
        markLastAction("chat:pushMessage");
        batchUpdates(() => {
          const currentState = get();
          set((state) => {
            const messages = [...state.messages, message];
            state._messageIndex.update(messages);
            return {
              messages,
            };
          });

          // During streaming, update immediately for smooth text rendering
          if (currentState.status === "streaming") {
            // High priority for streaming updates
            batchUpdates(() => {
              const state = get();
              const newThrottledMessages = [...state.messages];
              state._messageIndex.update(newThrottledMessages);

              set({
                _throttledMessages: newThrottledMessages,
              });
            }, 1);
          } else {
            throttledMessagesUpdater?.();
          }
        });
      },

      popMessage: () => {
        markLastAction("chat:popMessage");
        batchUpdates(() => {
          set((state) => {
            const messages = state.messages.slice(0, -1);
            state._messageIndex.update(messages);
            return {
              messages,
            };
          });
          throttledMessagesUpdater?.();
        });
      },

      replaceMessage: (index, message) => {
        markLastAction("chat:replaceMessage");
        batchUpdates(() => {
          const currentState = get();
          set((state) => {
            const newMessages = [...state.messages];
            newMessages[index] = structuredClone(message);
            state._messageIndex.update(newMessages);
            return {
              messages: newMessages,
            };
          });

          // During streaming, update immediately for smooth text rendering
          if (currentState.status === "streaming") {
            // High priority for streaming updates
            batchUpdates(() => {
              const state = get();
              const newThrottledMessages = [...state.messages];
              state._messageIndex.update(newThrottledMessages);

              set({
                _throttledMessages: newThrottledMessages,
              });
            }, 1);
          } else {
            throttledMessagesUpdater?.();
          }
        });
      },

      replaceMessageById: (id, message) => {
        markLastAction("chat:replaceMessageById");
        batchUpdates(() => {
          const currentState = get();
          set((state) => {
            const index = state._messageIndex.getIndexById(id);
            if (index === undefined) {
              return state;
            }

            const newMessages = [...state.messages];
            newMessages[index] = structuredClone(message);
            state._messageIndex.update(newMessages);
            return {
              messages: newMessages,
            };
          });

          // During streaming, update immediately for smooth text rendering
          if (currentState.status === "streaming") {
            // High priority for streaming updates
            batchUpdates(() => {
              const state = get();
              const newThrottledMessages = [...state.messages];
              state._messageIndex.update(newThrottledMessages);

              set({
                _throttledMessages: newThrottledMessages,
              });
            }, 1);
          } else {
            throttledMessagesUpdater?.();
          }
        });
      },

      _syncState: (newState) => {
        markLastAction("chat:_syncState");
        batchUpdates(() => {
          set(
            {
              ...newState,
              // Clear memoized selectors on sync
            },
            false
            // 'syncFromUseChat',
          );
        });
      },

      reset: () => {
        markLastAction("chat:reset");
        batchUpdates(() => {
          const state = get();
          const newMessageIndex = new MessageIndex<TMessage>();
          newMessageIndex.update([]);

          // Also clear messages via setMessages if available (to sync with chat helpers)
          if (state.setMessages) {
            state.setMessages([]);
          }

          set({
            _messageIndex: newMessageIndex,
            _throttledMessages: [],
            _transientDataParts: new Map(),
            error: undefined,
            id: undefined,
            messages: [],
            status: "ready" as const,
          });
        });
      },

      // Optimized getters
      getLastMessageId: () => {
        const state = get();
        return state.messages.length > 0
          ? state.messages[state.messages.length - 1].id
          : null;
      },

      getMessageIds: () => {
        const state = get();
        return (state._throttledMessages || state.messages).map((m) => m.id);
      },

      getThrottledMessages: () => {
        const state = get();
        return state._throttledMessages || state.messages;
      },

      getInternalMessages: () => {
        const state = get();
        return state.messages;
      },

      getMessageById: (id) => {
        const state = get();
        return state._messageIndex.getById(id);
      },

      getMessageIndexById: (id) => {
        const state = get();
        return state._messageIndex.getIndexById(id);
      },

      getMessagesSlice: (start, end) => {
        const state = get();
        const messages = state._throttledMessages || state.messages;
        return messages.slice(start, end);
      },

      getMessageCount: () => {
        const state = get();
        const messages = state._throttledMessages || state.messages;
        return messages.length;
      },

      // Effects
      registerThrottledMessagesEffect: (effect: () => void) => {
        throttledEffects.add(effect);
        return () => {
          throttledEffects.delete(effect);
        };
      },

      // Transient data methods
      setTransientDataPart: (type, data) => {
        markLastAction("chat:setTransientDataPart");
        batchUpdates(() => {
          set((state) => ({
            _transientDataParts: new Map(state._transientDataParts).set(
              type,
              data
            ),
          }));
        });
      },

      getTransientDataPart: (type) => {
        const state = get();
        return state._transientDataParts.get(type);
      },

      removeTransientDataPart: (type) => {
        markLastAction("chat:removeTransientDataPart");
        batchUpdates(() => {
          set((state) => {
            const newTransientDataParts = new Map(state._transientDataParts);
            newTransientDataParts.delete(type);
            return { _transientDataParts: newTransientDataParts };
          });
        });
      },

      clearTransientDataParts: () => {
        markLastAction("chat:clearTransientDataParts");
        batchUpdates(() => set({ _transientDataParts: new Map() }));
      },
    };
  };
};

export const createChatStore = <TMessage extends UIMessage = UIMessage>(
  initialMessages: TMessage[] = []
) =>
  createStore<StoreState<TMessage>>()(
    devtools(
      subscribeWithSelector(createChatStoreCreator<TMessage>(initialMessages)),
      { name: "chat-store" }
    )
  );

type ChatStoreApi<TMessage extends UIMessage = UIMessage> = ReturnType<
  typeof createChatStore<TMessage>
>;

// The provider can carry any message specialization; typed hooks select it at the boundary.
type ChatStoreHandle = Pick<
  StoreApi<unknown>,
  "getInitialState" | "getState" | "subscribe"
>;

export const ChatStoreContext = createContext<ChatStoreHandle | undefined>(
  undefined
);

type CompatibleChatStoreApi<TMessage extends UIMessage = UIMessage> = Omit<
  ChatStoreApi<TMessage>,
  "setState"
> & {
  setState(
    partial:
      | StoreState<TMessage>
      | Partial<StoreState<TMessage>>
      | ((
          state: StoreState<TMessage>
        ) => StoreState<TMessage> | Partial<StoreState<TMessage>>),
    replace?: boolean,
    action?:
      | (
          | string
          | {
              [x: string]: unknown;
              [x: number]: unknown;
              [x: symbol]: unknown;
              type: string;
            }
        )
      | undefined
  ): void;
};

export const Provider = <TMessage extends UIMessage = UIMessage>({
  children,
  initialMessages,
  store,
}: {
  children: React.ReactNode;
  initialMessages?: TMessage[];
  store?: CompatibleChatStoreApi<TMessage>;
}) => {
  const storeRef = useRef<CompatibleChatStoreApi<TMessage> | null>(null);

  if (storeRef.current === null) {
    storeRef.current =
      store || createChatStore<TMessage>(initialMessages || []);
  }

  return React.createElement(
    ChatStoreContext.Provider,
    { value: storeRef.current },
    children
  );
};

export const useChatStoreApi = <TMessage extends UIMessage = UIMessage>() => {
  const store = useContext(ChatStoreContext);
  if (!store) {
    throw new Error("useChatStoreApi must be used within Provider");
  }
  return store as ChatStoreApi<TMessage>;
};

// Standard Zustand v5 store hook
export function useChatStore<T, TMessage extends UIMessage = UIMessage>(
  selector: (store: StoreState<TMessage>) => T
): T;
export function useChatStore<
  TMessage extends UIMessage = UIMessage,
>(): StoreState<TMessage>;
export function useChatStore<
  T = StoreState<UIMessage>,
  TMessage extends UIMessage = UIMessage,
>(selector?: (store: StoreState<TMessage>) => T) {
  const store = useChatStoreApi<TMessage>();
  const selectorOrIdentity =
    selector ?? ((state: StoreState<TMessage>) => state);

  return useStore<ChatStoreApi<TMessage>, T | StoreState<TMessage>>(
    store,
    selectorOrIdentity
  );
}

// Optimized selector hooks with memoization
export const useChatMessages = <TMessage extends UIMessage = UIMessage>() =>
  useChatStore(
    useShallow((state: StoreState<TMessage>) => state.getThrottledMessages())
  );

// Stable selector functions to avoid recreation
const statusSelector = (state: StoreState) => state.status;
const errorSelector = (state: StoreState) => state.error;
const idSelector = (state: StoreState) => state.id;
const messageCountSelector = (state: StoreState) => state.getMessageCount();

export const useChatStatus = () => useChatStore(statusSelector);
export const useChatError = () => useChatStore(errorSelector);
export const useChatId = () => useChatStore(idSelector);
export const useMessageIds = <TMessage extends UIMessage = UIMessage>() =>
  useChatStore(
    useShallow((state: StoreState<TMessage>) => state.getMessageIds())
  );

// Optimized message selector with O(1) lookup
export const useMessageById = <TMessage extends UIMessage = UIMessage>(
  messageId: string
) =>
  useChatStore(
    useCallback(
      (state: StoreState<TMessage>) => state.getMessageById(messageId),
      [messageId]
    )
  );

// Virtualization helper for large message lists
export const useVirtualMessages = <TMessage extends UIMessage = UIMessage>(
  start: number,
  end?: number
) =>
  useChatStore(
    useCallback(
      (state: StoreState<TMessage>) => state.getMessagesSlice(start, end),
      [start, end]
    )
  );

export const useMessageCount = () => useChatStore(messageCountSelector);

// Reset hook for convenience
export const useChatReset = () => useChatStore((state) => state.reset);
// Stable fallback functions to prevent infinite loops
const fallbackSendMessage = () => {
  debug.warn(
    "sendMessage not configured - make sure useChat is called with transport"
  );
  return Promise.resolve();
};
const fallbackStartRun = () =>
  Promise.reject(
    new Error(
      "startRun not configured - make sure useChat is called with transport"
    )
  );
const fallbackRegenerate = () => {
  debug.warn(
    "regenerate not configured - make sure useChat is called with transport"
  );
  return Promise.resolve();
};
const fallbackStop = () => {
  debug.warn(
    "stop not configured - make sure useChat is called with transport"
  );
  return Promise.resolve();
};
const fallbackResumeStream = () => {
  debug.warn(
    "resumeStream not configured - make sure useChat is called with transport"
  );
  return Promise.resolve();
};
const fallbackAddToolResult = () => {
  debug.warn(
    "addToolResult not configured - make sure useChat is called with transport"
  );
  return Promise.resolve();
};
const fallbackClearError = () => {
  debug.warn(
    "clearError not configured - make sure useChat is called with transport"
  );
};

export type ChatActions<TMessage extends UIMessage = UIMessage> = {
  sendMessage: UseChatHelpers<TMessage>["sendMessage"];
  startRun: UseThreadHelpers<TMessage>["tree"]["startRun"];
  regenerate: UseChatHelpers<TMessage>["regenerate"];
  stop: UseChatHelpers<TMessage>["stop"];
  resumeStream: UseChatHelpers<TMessage>["resumeStream"];
  addToolResult: UseChatHelpers<TMessage>["addToolResult"];
  clearError: UseChatHelpers<TMessage>["clearError"];
};

export const useChatActions = <
  TMessage extends UIMessage = UIMessage,
>(): ChatActions<TMessage> =>
  useChatStore(
    useShallow((state: StoreState<TMessage>) => ({
      addToolResult: state.addToolResult || fallbackAddToolResult,
      clearError: state.clearError || fallbackClearError,
      regenerate: state.regenerate || fallbackRegenerate,
      resumeStream: state.resumeStream || fallbackResumeStream,
      sendMessage: state.sendMessage || fallbackSendMessage,
      startRun: state.startRun || fallbackStartRun,
      stop: state.stop || fallbackStop,
    }))
  );
