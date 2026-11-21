import { cookies, headers } from "next/headers";
import React, { Suspense } from "react";

import { getChatModels } from "@/app/actions/get-chat-models";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveDeletionProvider } from "@/components/eve/eve-deletion-provider";
import { EveRuntimeProvider } from "@/components/eve/eve-runtime-provider";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import {
  ChatWorkspace,
  ChatWorkspaceContent,
} from "@/components/chat/chat-workspace";
import {
  getConfiguredWebChatModel,
  getDefaultWebChatModelId,
} from "@/lib/ai/web-chat-models";
import { isPlaywrightTestEnvironment } from "@/lib/constants";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";
import { SessionProvider, SessionSeed } from "@/providers/session-provider";
import { ChatPlugins } from "@/providers/chat-plugins";
import { TRPCReactProvider } from "@/trpc/react";
import { HydrateClient } from "@/trpc/server";

import { auth } from "@/lib/auth";

const ChatLayoutDynamic = async ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): Promise<React.JSX.Element> => {
  const [cookieStore, headersRes, chatModels] = await Promise.all([
    cookies(),
    headers(),
    getChatModels(),
  ]);
  const session = isPlaywrightTestEnvironment
    ? null
    : await auth.api.getSession({ headers: headersRes });
  const principal = isPlaywrightTestEnvironment
    ? null
    : await resolveEvePrincipal(headersRes);

  const cookieModel = cookieStore.get("chat-model")?.value;

  const defaultModel =
    chatModels.find((model) => model.id === cookieModel)?.id ??
    getDefaultWebChatModelId(chatModels) ??
    getConfiguredWebChatModel();

  return (
    <HydrateClient>
      <SessionSeed session={session} />

      <ChatModelsProvider models={chatModels}>
        <DefaultModelProvider defaultModel={defaultModel}>
          <KeyboardShortcuts />
          <EveRuntimeProvider
            key={principal?.ownerId ?? "anonymous"}
            ownerId={principal?.ownerId}
          >
            {children}
          </EveRuntimeProvider>
        </DefaultModelProvider>
      </ChatModelsProvider>
    </HydrateClient>
  );
};

const ChatLayout = async ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): Promise<React.JSX.Element> => {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const content = (
    <>
      <AppSidebar />
      <ChatWorkspaceContent className="h-dvh min-w-0">
        <Suspense fallback={<ChatLoadingShell />}>
          <ChatLayoutDynamic>{children}</ChatLayoutDynamic>
        </Suspense>
      </ChatWorkspaceContent>
    </>
  );
  return (
    <TRPCReactProvider>
      <SessionProvider>
        <ChatWorkspace defaultOpen={defaultOpen}>
          <ChatPlugins>
            <EveDeletionProvider>{content}</EveDeletionProvider>
          </ChatPlugins>
        </ChatWorkspace>
      </SessionProvider>
    </TRPCReactProvider>
  );
};
export default ChatLayout;
