"use client";

import type { UIMessage } from "@ai-sdk/react";
import type { MessageTreeSnapshot } from "@chatjs/thread";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useRef,
} from "react";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { ChatMessage } from "@/lib/ai/types";
import { ApplicationThread } from "@/lib/application-thread";
import {
  Provider as ChatProvider,
  ChatStoreContext,
  createChatStoreCreator,
} from "@/lib/stores/base";
import { generateUUID } from "@/lib/utils";

import {
  type ChatPersistenceAugmentedState,
  withChatPersistence,
} from "./with-chat-persistence";
import {
  type DataStreamAugmentedState,
  withDataStream,
} from "./with-data-stream";
import {
  type PartsAugmentedState,
  withMessageParts,
} from "./with-message-parts";
import { type ThreadStateStore, withThreadState } from "./with-thread-state";
import { withTracing } from "./with-tracing";
import { ZustandThreadState } from "./zustand-thread-state";

export type CustomChatStoreState<UI_MESSAGE extends UIMessage = UIMessage> =
  ChatPersistenceAugmentedState<UI_MESSAGE> &
    DataStreamAugmentedState<UI_MESSAGE> &
    PartsAugmentedState<UI_MESSAGE> &
    ThreadStateStore<UI_MESSAGE>;

const ENABLE_TRACING_ON_DEV = false;
export function createCustomChatStore<TMessage extends UIMessage = UIMessage>(
  initialMessages: TMessage[] = [],
  options: {
    initialIsChatPersisted?: boolean;
    initialTree?: MessageTreeSnapshot<TMessage>;
  } = {}
) {
  return createStore<CustomChatStoreState<TMessage>>()(
    devtools(
      subscribeWithSelector(
        withTracing(
          withChatPersistence(
            withDataStream(
              withThreadState(
                withMessageParts(
                  createChatStoreCreator<TMessage>(initialMessages)
                ),
                { initialTree: options.initialTree }
              )
            ),
            {
              initialIsChatPersisted: options.initialIsChatPersisted,
            }
          ),
          process.env.NODE_ENV === "development" && ENABLE_TRACING_ON_DEV
        )
      ),
      { name: "chat-store" }
    )
  );
}

export type CustomChatStoreApi<TMessage extends UIMessage = UIMessage> =
  ReturnType<typeof createCustomChatStore<TMessage>>;

const ApplicationThreadContext = createContext<ApplicationThread | null>(null);

export function useCustomChatStoreApi<
  TMessage extends UIMessage = UIMessage,
>() {
  const store = useContext(ChatStoreContext);
  if (!store) {
    throw new Error("useChatStoreApi must be used within Provider");
  }
  return store as CustomChatStoreApi<TMessage>;
}

export function useApplicationThread() {
  const thread = useContext(ApplicationThreadContext);
  if (!thread) {
    throw new Error(
      "useApplicationThread must be used within CustomStoreProvider"
    );
  }
  return thread;
}

type ChatProviderProps = Parameters<typeof ChatProvider>[0];

export function CustomStoreProvider({
  initialMessages = [],
  initialTree,
  children,
  store,
  thread,
  threadId,
}: PropsWithChildren<{
  initialMessages?: ChatMessage[];
  initialTree?: MessageTreeSnapshot<ChatMessage>;
  store?: CustomChatStoreApi<ChatMessage>;
  thread?: ApplicationThread;
  threadId?: string;
}> &
  Omit<ChatProviderProps, "initialMessages" | "store">) {
  const storeRef = useRef<CustomChatStoreApi<ChatMessage> | null>(null);

  if (storeRef.current === null) {
    storeRef.current =
      store ??
      createCustomChatStore<ChatMessage>(initialMessages, { initialTree });
  }

  const threadRef = useRef<ApplicationThread | null>(null);
  if (threadRef.current === null) {
    threadRef.current =
      thread ??
      new ApplicationThread({
        id: threadId ?? generateUUID(),
        state: new ZustandThreadState(storeRef.current),
      });
  }

  return (
    <ApplicationThreadContext.Provider value={threadRef.current}>
      <ChatProvider<ChatMessage>
        initialMessages={initialMessages}
        store={storeRef.current || undefined}
      >
        {children}
      </ChatProvider>
    </ApplicationThreadContext.Provider>
  );
}
