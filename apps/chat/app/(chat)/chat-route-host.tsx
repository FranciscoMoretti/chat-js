"use client";

import { useQuery } from "@tanstack/react-query";
import {
  notFound,
  redirect,
  usePathname,
  useSearchParams,
} from "next/navigation";
import { type ReactNode, useEffect, useMemo } from "react";
import { ChatSystem } from "@/components/chat-system";
import {
  useGetChatByIdQueryOptions,
  useGetChatMessagesQueryOptions,
} from "@/hooks/chat-sync-hooks";
import { useChatSystemInitialState } from "@/hooks/use-chat-system-initial-state";
import type { AppModelId } from "@/lib/ai/app-models";
import {
  type AppRuntime,
  type AppRuntimeData,
  type CreateAppRuntimeInput,
  createAppRuntimeInput,
  useCurrentProvisionalAppRuntimeIdentity,
} from "@/lib/app-chat-runtime";
import {
  type ChatRuntimeId,
  createMainChatRuntimeId,
} from "@/lib/chat-runtime-id";
import { useRuntime, useRuntimeActions } from "@/lib/runtime-registry";
import { useRuntimeIsChatPersisted } from "@/lib/stores/hooks-chat-persistence";
import { useChatModels } from "@/providers/chat-models-provider";
import {
  type ParsedChatIdFromPathname,
  parseChatIdFromPathname,
} from "@/providers/parse-chat-id-from-pathname";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

interface ChatRouteHostProps {
  children: ReactNode;
}

function ChatLoadingShell() {
  return <div className="h-dvh w-full bg-background" />;
}

type HostedParsedChatRoute = Extract<
  ParsedChatIdFromPathname,
  { type: "chat" | "home" | "projectChat" | "projectHome" }
>;

type PersistedChatRoute = Extract<
  ParsedChatIdFromPathname,
  { type: "chat" | "projectChat" }
>;

function getPersistedRoute(route: HostedParsedChatRoute) {
  return route.type === "chat" || route.type === "projectChat" ? route : null;
}

function getProjectHomeId(route: HostedParsedChatRoute) {
  return route.type === "projectHome" ? route.projectId : null;
}

function getProjectIdForChatSystem({
  persistedRoute,
  projectId,
  route,
}: {
  persistedRoute: PersistedChatRoute | null;
  projectId?: string;
  route: HostedParsedChatRoute;
}) {
  if (route.type === "projectHome") {
    return projectId;
  }

  return persistedRoute?.projectId ?? undefined;
}

function shouldShowSessionLoading({
  isSessionPending,
  route,
}: {
  isSessionPending: boolean;
  route: HostedParsedChatRoute;
}) {
  return isSessionPending && route.type !== "home";
}

function shouldRedirectForAuth({
  hasUser,
  route,
}: {
  hasUser: boolean;
  route: HostedParsedChatRoute;
}) {
  return route.type !== "home" && !hasUser;
}

function shouldShowProjectLoading({
  isProjectPending,
  route,
}: {
  isProjectPending: boolean;
  route: HostedParsedChatRoute;
}) {
  return route.type === "projectHome" && isProjectPending;
}

function shouldShowPersistedLoading({
  chatReady,
  hasLiveRuntime,
  messagesReady,
  persistedRoute,
}: {
  chatReady: boolean;
  hasLiveRuntime: boolean;
  messagesReady: boolean;
  persistedRoute: PersistedChatRoute | null;
}) {
  return !!(persistedRoute && !hasLiveRuntime && !(chatReady && messagesReady));
}

function shouldReturnNotFound({
  chat,
  chatError,
  hasLiveRuntime,
  messagesError,
  persistedRoute,
  project,
  route,
}: {
  chat: { projectId: string | null } | null | undefined;
  chatError: unknown;
  hasLiveRuntime: boolean;
  messagesError: unknown;
  persistedRoute: PersistedChatRoute | null;
  project: unknown;
  route: HostedParsedChatRoute;
}) {
  if (route.type === "projectHome" && !project) {
    return true;
  }

  if (
    persistedRoute &&
    !hasLiveRuntime &&
    (chatError || messagesError || !chat)
  ) {
    return true;
  }

  return !!(
    persistedRoute?.type === "projectChat" &&
    chat &&
    chat.projectId !== persistedRoute.projectId
  );
}

const PERSISTED_CHAT_ROUTE_QUERY_OPTIONS = {
  gcTime: 0,
  refetchOnMount: "always" as const,
  refetchOnReconnect: "always" as const,
  refetchOnWindowFocus: "always" as const,
  staleTime: 0,
};

function getFreshRouteQueryData<TData>({
  data,
  isFetchedAfterMount,
}: {
  data: TData | undefined;
  isFetchedAfterMount: boolean;
}) {
  return isFetchedAfterMount ? data : undefined;
}

function isFreshRouteQueryReady({
  isFetchedAfterMount,
}: {
  isFetchedAfterMount: boolean;
}) {
  return isFetchedAfterMount;
}

function getFreshRouteQueryError({
  error,
  isFetchedAfterMount,
}: {
  error: unknown;
  isFetchedAfterMount: boolean;
}) {
  return isFetchedAfterMount ? error : null;
}

function getOverrideModelId({
  getModelById,
  route,
  value,
}: {
  getModelById: ReturnType<typeof useChatModels>["getModelById"];
  route: HostedParsedChatRoute;
  value: string | null;
}) {
  return route.type === "home" && value && getModelById(value)
    ? (value as AppModelId)
    : undefined;
}

function canCreateRouteRuntime({
  persistedRoute,
  project,
  route,
}: {
  persistedRoute: PersistedChatRoute | null;
  project: unknown;
  route: HostedParsedChatRoute;
}) {
  if (persistedRoute) {
    return false;
  }

  return route.type === "home" || (route.type === "projectHome" && !!project);
}

interface RouteRuntimeCreationRequest {
  runtimeInput: CreateAppRuntimeInput;
}

function getRouteRuntimeCreationRequest({
  existingRuntime,
  initialMessages,
  initialTool,
  persistedChat,
  persistedMessages,
  persistedRoute,
  project,
  runtimeId,
  route,
}: {
  existingRuntime: AppRuntime | null;
  initialMessages: ReturnType<
    typeof useChatSystemInitialState
  >["initialMessages"];
  initialTool: ReturnType<typeof useChatSystemInitialState>["initialTool"];
  persistedChat: { projectId: string | null } | null | undefined;
  persistedMessages: unknown;
  persistedRoute: PersistedChatRoute | null;
  project: unknown;
  runtimeId: ChatRuntimeId | null;
  route: HostedParsedChatRoute;
}): RouteRuntimeCreationRequest | null {
  if (existingRuntime || !runtimeId) {
    return null;
  }

  if (persistedRoute) {
    if (!(persistedChat && Array.isArray(persistedMessages))) {
      return null;
    }

    return {
      runtimeInput: createAppRuntimeInput({
        bootstrap: true,
        initialMessages,
        initialTool,
        runtimeId,
      }),
    };
  }

  if (!canCreateRouteRuntime({ persistedRoute, project, route })) {
    return null;
  }

  return {
    runtimeInput: createAppRuntimeInput({
      bootstrap: false,
      runtimeId,
    }),
  };
}

function useEnsureRouteRuntimeAfterCommit(
  request: RouteRuntimeCreationRequest | null
) {
  const { ensureRuntime } = useRuntimeActions<AppRuntimeData>();

  useEffect(() => {
    if (!request) {
      return;
    }

    ensureRuntime(request.runtimeInput);
  }, [ensureRuntime, request]);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Coordinates route data, persisted state, and live runtime fallback.
function HostedChatRoute({ route }: { route: HostedParsedChatRoute }) {
  const { data: session, isPending: isSessionPending } = useSession();
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const { getModelById } = useChatModels();
  const projectHomeId = getProjectHomeId(route);
  const provisionalRuntime = useCurrentProvisionalAppRuntimeIdentity();
  const persistedRoute = getPersistedRoute(route);
  const runtimeChatId =
    persistedRoute?.id ?? provisionalRuntime?.chatId ?? null;
  const runtimeId = persistedRoute
    ? createMainChatRuntimeId(persistedRoute.id)
    : (provisionalRuntime?.runtimeId ?? null);
  const existingRuntime = useRuntime<AppRuntimeData>(runtimeId);
  const existingStore = existingRuntime?.data.store ?? null;
  const isExistingRuntimePersisted = useRuntimeIsChatPersisted(existingStore);
  const persistedChatId = persistedRoute?.id ?? "";
  const shouldLoadPersistedMessages =
    !!persistedRoute && isExistingRuntimePersisted && !isSessionPending;

  const projectQuery = useQuery({
    ...trpc.project.getById.queryOptions({ id: projectHomeId ?? "" }),
    enabled:
      route.type === "projectHome" && !!session?.user && !isSessionPending,
  });

  const chatQueryOptions = useGetChatByIdQueryOptions(persistedChatId);
  const messagesQueryOptions = useGetChatMessagesQueryOptions(persistedChatId);
  const chatQuery = useQuery({
    ...chatQueryOptions,
    ...PERSISTED_CHAT_ROUTE_QUERY_OPTIONS,
    enabled: shouldLoadPersistedMessages && (chatQueryOptions.enabled ?? true),
  });
  const messagesQuery = useQuery({
    ...messagesQueryOptions,
    ...PERSISTED_CHAT_ROUTE_QUERY_OPTIONS,
    enabled:
      shouldLoadPersistedMessages && (messagesQueryOptions.enabled ?? true),
  });

  const chatQueryReady = isFreshRouteQueryReady({
    isFetchedAfterMount: chatQuery.isFetchedAfterMount,
  });
  const messagesQueryReady = isFreshRouteQueryReady({
    isFetchedAfterMount: messagesQuery.isFetchedAfterMount,
  });
  const persistedChat = getFreshRouteQueryData({
    data: chatQuery.data,
    isFetchedAfterMount: chatQuery.isFetchedAfterMount,
  });
  const persistedMessages = getFreshRouteQueryData({
    data: messagesQuery.data,
    isFetchedAfterMount: messagesQuery.isFetchedAfterMount,
  });
  const persistedChatError = getFreshRouteQueryError({
    error: chatQuery.error,
    isFetchedAfterMount: chatQuery.isFetchedAfterMount,
  });
  const persistedMessagesError = getFreshRouteQueryError({
    error: messagesQuery.error,
    isFetchedAfterMount: messagesQuery.isFetchedAfterMount,
  });

  const persistedInitialState = useChatSystemInitialState(persistedMessages);
  const runtimeCreationRequest = useMemo(
    () =>
      getRouteRuntimeCreationRequest({
        existingRuntime,
        initialMessages: persistedInitialState.initialMessages,
        initialTool: persistedInitialState.initialTool,
        persistedChat,
        persistedMessages,
        persistedRoute,
        project: projectQuery.data,
        runtimeId,
        route,
      }),
    [
      existingRuntime,
      persistedChat,
      persistedInitialState.initialMessages,
      persistedInitialState.initialTool,
      persistedMessages,
      persistedRoute,
      projectQuery.data,
      route,
      runtimeId,
    ]
  );
  useEnsureRouteRuntimeAfterCommit(runtimeCreationRequest);
  const liveRuntime = existingRuntime;
  const liveStore = existingStore;
  const hasLiveRuntime = !!(liveRuntime && liveStore);
  const liveRuntimeMessages = liveStore?.getState().messages;

  useEffect(() => {
    if (!(liveStore && persistedMessages)) {
      return;
    }

    liveStore.getState().setAllMessages(persistedMessages);
  }, [liveStore, persistedMessages]);

  const initialMessages =
    liveRuntimeMessages ?? persistedInitialState.initialMessages;
  const initialTool =
    liveRuntime?.data.initialTool ?? persistedInitialState.initialTool;

  const value = searchParams.get("modelId");
  const overrideModelId = getOverrideModelId({ getModelById, route, value });
  const id = runtimeChatId;
  if (shouldShowSessionLoading({ isSessionPending, route })) {
    return null;
  }

  if (shouldRedirectForAuth({ hasUser: !!session?.user, route })) {
    redirect("/");
  }

  if (
    shouldShowProjectLoading({
      isProjectPending: projectQuery.isPending,
      route,
    })
  ) {
    return null;
  }

  if (
    shouldShowPersistedLoading({
      chatReady: chatQueryReady,
      hasLiveRuntime,
      messagesReady: messagesQueryReady,
      persistedRoute,
    })
  ) {
    return <ChatLoadingShell />;
  }

  if (
    shouldReturnNotFound({
      chat: persistedChat,
      chatError: persistedChatError,
      hasLiveRuntime,
      messagesError: persistedMessagesError,
      persistedRoute,
      project: projectQuery.data,
      route,
    })
  ) {
    return notFound();
  }

  if (!id) {
    return null;
  }

  if (!(liveRuntime && liveStore)) {
    return <ChatLoadingShell />;
  }

  return (
    <ChatSystem
      chat={persistedChat ?? null}
      id={id}
      initialMessages={initialMessages}
      initialTool={initialTool}
      isReadonly={false}
      overrideModelId={overrideModelId}
      projectId={getProjectIdForChatSystem({
        persistedRoute,
        projectId: projectQuery.data?.id,
        route,
      })}
      routeSource={route.source}
      runtimeKey={liveRuntime.runtimeId}
      store={liveStore}
    />
  );
}

export function ChatRouteHost({ children }: ChatRouteHostProps) {
  const pathname = usePathname();
  const route = useMemo(() => parseChatIdFromPathname(pathname), [pathname]);

  const hosted =
    route.type === "home" ||
    route.type === "projectHome" ||
    route.type === "chat" ||
    route.type === "projectChat";

  return hosted ? <HostedChatRoute route={route} /> : children;
}
