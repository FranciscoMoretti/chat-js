import type { MessageTreeSnapshot } from "@chat-js/thread";
import { createContext, createElement, useContext, useRef } from "react";
import type { ReactNode } from "react";

import type { ChatRuntimeId } from "@/lib/chat-runtime-id";
import {
  createMainChatRuntimeId,
  parseChatRuntimeId,
} from "@/lib/chat-runtime-id";
import type { CreateRuntimeInput, Runtime } from "@/lib/runtime-registry";
import { generateUUID } from "@/lib/utils";

import type { ChatMessage, UiToolName } from "./ai/types";
import { ApplicationThread } from "./application-thread";
import { createCustomChatStore } from "./stores/custom-store-provider";
import type { CustomChatStoreApi } from "./stores/custom-store-provider";
import { ZustandThreadState } from "./stores/zustand-thread-state";

export interface AppRuntimeData {
  bootstrap: boolean;
  chatId: string;
  initialMessages?: ChatMessage[];
  initialTool?: UiToolName | null;
  store: CustomChatStoreApi<ChatMessage>;
  thread: ApplicationThread;
  threadId: string;
}

export type AppRuntime = Runtime<AppRuntimeData>;
export type CreateAppRuntimeInput = CreateRuntimeInput<AppRuntimeData>;

export interface ProvisionalAppRuntimeIdentity {
  chatId: string;
  runtimeId: ChatRuntimeId;
}

const ProvisionalAppRuntimeIdentityContext =
  createContext<ProvisionalAppRuntimeIdentity | null>(null);

export const ProvisionalAppRuntimeIdentityProvider = ({
  children,
  identity,
}: {
  children: ReactNode;
  identity: ProvisionalAppRuntimeIdentity | null;
}) =>
  createElement(
    ProvisionalAppRuntimeIdentityContext.Provider,
    { value: identity },
    children
  );

export const useCurrentProvisionalAppRuntimeIdentity = () =>
  useContext(ProvisionalAppRuntimeIdentityContext);

export const useProvisionalAppRuntimeIdentity = (
  scopeKey: string | null | undefined
): ProvisionalAppRuntimeIdentity | null => {
  const identityRef = useRef<{
    identity: ProvisionalAppRuntimeIdentity;
    scopeKey: string;
  } | null>(null);

  if (!scopeKey) {
    identityRef.current = null;
    return null;
  }

  if (identityRef.current?.scopeKey !== scopeKey) {
    const chatId = generateUUID();

    identityRef.current = {
      identity: {
        chatId,
        runtimeId: createMainChatRuntimeId(chatId),
      },
      scopeKey,
    };
  }

  return identityRef.current.identity;
};

const createAppRuntimeStore = ({
  bootstrap,
  initialMessages,
  initialTree,
}: {
  bootstrap: boolean;
  initialMessages?: ChatMessage[];
  initialTree?: MessageTreeSnapshot<ChatMessage>;
}) =>
  createCustomChatStore<ChatMessage>(initialMessages ?? [], {
    initialIsChatPersisted: bootstrap,
    initialTree,
  });

export const createAppRuntimeInput = ({
  bootstrap,
  initialMessages,
  initialTree,
  initialTool,
  runtimeId,
}: {
  bootstrap: boolean;
  initialMessages?: ChatMessage[];
  initialTree?: MessageTreeSnapshot<ChatMessage>;
  initialTool?: UiToolName | null;
  runtimeId: ChatRuntimeId;
}): CreateAppRuntimeInput => {
  const parsed = parseChatRuntimeId(runtimeId);
  if (!parsed) {
    throw new Error(`Invalid chat runtime id: ${runtimeId}`);
  }

  const store = createAppRuntimeStore({
    bootstrap,
    initialMessages,
    initialTree,
  });
  const thread = new ApplicationThread({
    id: parsed.chatId,
    state: new ZustandThreadState(store),
  });

  return {
    data: {
      bootstrap,
      chatId: parsed.chatId,
      initialMessages,
      initialTool,
      store,
      thread,
      threadId: parsed.threadId,
    },
    runtimeId,
  };
};

export const getAppRuntimeStore = (runtime: AppRuntime) => runtime.data.store;

export const getAppRuntimeThread = (runtime: AppRuntime) => runtime.data.thread;
