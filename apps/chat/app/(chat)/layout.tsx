import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { getChatModels } from "@/app/actions/get-chat-models";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { AppModelId } from "@/lib/ai/app-model-id";
import { config } from "@/lib/config";
import { isPlaywrightTestEnvironment } from "@/lib/constants";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";
import { SessionProvider, SessionSeed } from "@/providers/session-provider";
import { TRPCReactProvider } from "@/trpc/react";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { auth } from "../../lib/auth";
import { ChatProviders } from "./chat-providers";
import { ChatRouteHost } from "./chat-route-host";

const sidebarInsetClassName = "[--header-height:calc(var(--spacing)*13)]";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <TRPCReactProvider>
      <SessionProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <SidebarInset className={sidebarInsetClassName}>
            <Suspense fallback={<ChatLoadingShell />}>
              <ChatLayoutDynamic>{children}</ChatLayoutDynamic>
            </Suspense>
          </SidebarInset>
        </SidebarProvider>
      </SessionProvider>
    </TRPCReactProvider>
  );
}

async function ChatLayoutDynamic({ children }: { children: React.ReactNode }) {
  const [cookieStore, headersRes, chatModels] = await Promise.all([
    cookies(),
    headers(),
    getChatModels(),
  ]);
  const session = isPlaywrightTestEnvironment
    ? null
    : await auth.api.getSession({ headers: headersRes });

  const cookieModel = cookieStore.get("chat-model")?.value;
  const isAnonymous = !session?.user;

  const default_chat_model = config.ai.workflows.chat;
  let defaultModel: AppModelId =
    (cookieModel as AppModelId) ?? default_chat_model;

  if (cookieModel) {
    const modelExists = chatModels.some((m) => m.id === cookieModel);
    if (!modelExists) {
      defaultModel = default_chat_model;
    } else if (isAnonymous) {
      const isModelAvailable = (
        ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]
      ).includes(cookieModel as AppModelId);
      if (!isModelAvailable) {
        defaultModel = default_chat_model;
      }
    }
  }

  if (isAnonymous) {
    const anonymousModels =
      ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[];
    if (!anonymousModels.includes(defaultModel)) {
      defaultModel = anonymousModels[0] ?? default_chat_model;
    }
  }

  if (session?.user?.id) {
    const queryClient = getQueryClient();
    // "Lazy prefetch": don't await; pending queries are dehydrated + streamed.
    queryClient.prefetchQuery(trpc.settings.getModelPreferences.queryOptions());
    queryClient.prefetchQuery(trpc.project.list.queryOptions());
    queryClient.prefetchQuery(
      trpc.chat.getAllChats.queryOptions({ projectId: null })
    );
  }

  return (
    <HydrateClient>
      <SessionSeed session={session} />
      <ChatProviders>
        <ChatModelsProvider models={chatModels}>
          <DefaultModelProvider defaultModel={defaultModel}>
            <KeyboardShortcuts />
            <ChatRouteHost>{children}</ChatRouteHost>
          </DefaultModelProvider>
        </ChatModelsProvider>
      </ChatProviders>
    </HydrateClient>
  );
}
