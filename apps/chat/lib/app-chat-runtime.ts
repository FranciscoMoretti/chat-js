import type { MessageTreeSnapshot } from "@chat-js/thread";
import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useRef,
} from "react";
import type { ChatRuntimeId } from "@/lib/chat-runtime-id";
import {
  createMainChatRuntimeId,
  parseChatRuntimeId,
} from "@/lib/chat-runtime-id";
import type { CreateRuntimeInput, Runtime } from "@/lib/runtime-registry";
import { generateUUID } from "@/lib/utils";
import type { ChatMessage, UiToolName } from "./ai/types";
import { ApplicationThread } from "./application-thread";
import {
  type CustomChatStoreApi,
  createCustomChatStore,
} from "./stores/custom-store-provider";
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

export function ProvisionalAppRuntimeIdentityProvider({
  children,
  identity,
}: {
  children: ReactNode;
  identity: ProvisionalAppRuntimeIdentity | null;
}) {
  return createElement(
    ProvisionalAppRuntimeIdentityContext.Provider,
    { value: identity },
    children
  );
}

export function useCurrentProvisionalAppRuntimeIdentity() {
  return useContext(ProvisionalAppRuntimeIdentityContext);
}

export function useProvisionalAppRuntimeIdentity(
  scopeKey: string | null | undefined
): ProvisionalAppRuntimeIdentity | null {
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
}

export function createAppRuntimeInput({
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
}): CreateAppRuntimeInput {
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
}

function createAppRuntimeStore({
  bootstrap,
  initialMessages,
  initialTree,
}: {
  bootstrap: boolean;
  initialMessages?: ChatMessage[];
  initialTree?: MessageTreeSnapshot<ChatMessage>;
}) {
  return createCustomChatStore<ChatMessage>(initialMessages ?? [], {
    initialIsChatPersisted: bootstrap,
    initialTree,
  });
}

export function getAppRuntimeStore(runtime: AppRuntime) {
  return runtime.data.store;
}

export function getAppRuntimeThread(runtime: AppRuntime) {
  return runtime.data.thread;
}
