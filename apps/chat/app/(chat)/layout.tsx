import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { getChatModels } from "@/app/actions/get-chat-models";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppModelId } from "@/lib/ai/app-model-id";
import { config } from "@/lib/config";
import { isPlaywrightTestEnvironment } from "@/lib/constants";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";
import { SessionProvider } from "@/providers/session-provider";
import { TRPCReactProvider } from "@/trpc/react";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { auth } from "../../lib/auth";
import { ChatProviders } from "./chat-providers";
import { ChatRouteHost } from "./chat-route-host";

const sidebarInsetClassName = "[--header-height:calc(var(--spacing)*13)]";

function AppSidebarFallback() {
  return (
    <div className="hidden h-dvh w-(--sidebar-width) shrink-0 flex-col gap-3 border-r bg-sidebar p-3 md:flex">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <div className="mt-2 flex flex-1 flex-col gap-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-5/6" />
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-7 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function ChatLayoutShell() {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebarFallback />
      <SidebarInset className={sidebarInsetClassName}>
        <div className="h-dvh w-full bg-background" />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ChatLayoutShell />}>
      <ChatLayoutContent>{children}</ChatLayoutContent>
    </Suspense>
  );
}

async function ChatLayoutContent({ children }: { children: React.ReactNode }) {
  const [cookieStore, headersRes, chatModels] = await Promise.all([
    cookies(),
    headers(),
    getChatModels(),
  ]);
  const session = isPlaywrightTestEnvironment
    ? null
    : await auth.api.getSession({ headers: headersRes });
  const isCollapsed = cookieStore.get("sidebar:state")?.value !== "true";

  const cookieModel = cookieStore.get("chat-model")?.value;
  const isAnonymous = !session?.user;

  const default_chat_model = config.ai.workflows.chat;
  // Check if the model from cookie exists in available models
  let defaultModel: AppModelId =
    (cookieModel as AppModelId) ?? default_chat_model;

  if (cookieModel) {
    const modelExists = chatModels.some((m) => m.id === cookieModel);
    if (!modelExists) {
      // Model doesn't exist in available models, fall back to default
      defaultModel = default_chat_model;
    } else if (isAnonymous) {
      // For anonymous users, also check if the model is in their allowed list
      const isModelAvailable = (
        ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]
      ).includes(cookieModel as AppModelId);
      if (!isModelAvailable) {
        defaultModel = default_chat_model;
      }
    }
  }

  // Ensure anonymous users always get a model from their allowed list
  if (isAnonymous) {
    const anonymousModels =
      ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[];
    if (!anonymousModels.includes(defaultModel)) {
      defaultModel = anonymousModels[0] ?? default_chat_model;
    }
  }

  // Prefetch model preferences for authenticated users
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
    <TRPCReactProvider>
      <HydrateClient>
        <SessionProvider initialSession={session}>
          <ChatProviders>
            <SidebarProvider defaultOpen={!isCollapsed}>
              <Suspense fallback={<AppSidebarFallback />}>
                <AppSidebar />
              </Suspense>
              <SidebarInset className={sidebarInsetClassName}>
                <ChatModelsProvider models={chatModels}>
                  <DefaultModelProvider defaultModel={defaultModel}>
                    <KeyboardShortcuts />
                    <Suspense fallback={<ChatLoadingShell />}>
                      <ChatRouteHost>{children}</ChatRouteHost>
                    </Suspense>
                  </DefaultModelProvider>
                </ChatModelsProvider>
              </SidebarInset>
            </SidebarProvider>
          </ChatProviders>
        </SessionProvider>
      </HydrateClient>
    </TRPCReactProvider>
  );
}
