import { cookies, headers } from "next/headers";
import React, { Suspense } from "react";

import { getChatModels } from "@/app/actions/get-chat-models";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveDeletionProvider } from "@/components/eve/eve-deletion-provider";
import { EveRuntimeProvider } from "@/components/eve/eve-runtime-provider";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { AppModelId } from "@/lib/ai/app-model-id";
import { config } from "@/lib/config";
import { isPlaywrightTestEnvironment } from "@/lib/constants";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";
import { SessionProvider, SessionSeed } from "@/providers/session-provider";
import { preloadQuery } from "@/trpc/preload-query";
import { TRPCReactProvider } from "@/trpc/react";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

import { auth } from "@/lib/auth";

const sidebarInsetClassName = "[--header-height:calc(var(--spacing)*13)]";

const resolveDefaultModel = (
  cookieModel: string | undefined,
  chatModels: readonly { readonly id: string }[],
  isAnonymous: boolean
): AppModelId => {
  const configuredModel = config.ai.workflows.chat;
  const anonymousModels: readonly AppModelId[] =
    ANONYMOUS_LIMITS.AVAILABLE_MODELS;
  let defaultModel: AppModelId = cookieModel ?? configuredModel;

  if (typeof cookieModel === "string" && cookieModel !== "") {
    const modelExists = chatModels.some((model) => model.id === cookieModel);
    if (
      !modelExists ||
      (isAnonymous && !anonymousModels.includes(cookieModel))
    ) {
      defaultModel = configuredModel;
    }
  }
  if (isAnonymous && !anonymousModels.includes(defaultModel)) {
    return anonymousModels[0] ?? configuredModel;
  }
  return defaultModel;
};

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
  const isAnonymous = !session?.user;

  const defaultModel = resolveDefaultModel(
    cookieModel,
    chatModels,
    isAnonymous
  );

  if ((session?.user?.id ?? "") !== "") {
    const queryClient = getQueryClient();
    // "Lazy prefetch": don't await; pending queries are dehydrated + streamed.

    // Preloading must swallow preload errors while pending queries are dehydrated and streamed.
    void preloadQuery(
      queryClient.query(trpc.settings.getModelPreferences.queryOptions())
    );

    // Preloading must swallow preload errors while pending queries are dehydrated and streamed.
  }

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
      <SidebarInset className={sidebarInsetClassName}>
        <Suspense fallback={<ChatLoadingShell />}>
          <ChatLayoutDynamic>{children}</ChatLayoutDynamic>
        </Suspense>
      </SidebarInset>
    </>
  );
  return (
    <TRPCReactProvider>
      <SessionProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <EveDeletionProvider>{content}</EveDeletionProvider>
        </SidebarProvider>
      </SessionProvider>
    </TRPCReactProvider>
  );
};
export default ChatLayout;
