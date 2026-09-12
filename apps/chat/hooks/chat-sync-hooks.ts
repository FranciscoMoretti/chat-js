"use client";
// Hooks for chat data fetching and mutations
// For authenticated users only - anonymous users don't persist data
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import type { ChatMessage } from "@/lib/ai/types";
import { getAnonymousSession } from "@/lib/anonymous-session-client";
import { useCurrentChatRoute } from "@/lib/chat-route";
import type { Document, Project } from "@/lib/db/schema";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import type { UIChat } from "@/lib/types/ui-chat";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

// Query key for anonymous credits - allows invalidation after messages
const ANONYMOUS_CREDITS_KEY = ["anonymousCredits"] as const;
const snapshotAllChatsQueries = (
  qc: ReturnType<typeof useQueryClient>,
  key: QueryKey
) => qc.getQueriesData<UIChat[]>({ queryKey: key });
const restoreAllChatsQueries = (
  qc: ReturnType<typeof useQueryClient>,
  snapshot: [QueryKey, UIChat[] | undefined][]
) => {
  for (const [k, data] of snapshot) {
    qc.setQueryData(k, data);
  }
};
const updateAllChatsQueries = (
  qc: ReturnType<typeof useQueryClient>,
  key: QueryKey,
  updater: (old: UIChat[] | undefined) => UIChat[] | undefined
) => {
  const entries = qc.getQueriesData<UIChat[]>({ queryKey: key });
  for (const [k] of entries) {
    qc.setQueryData<UIChat[] | undefined>(k, updater);
  }
};
export const useProject = (
  projectId: string | null,
  {
    enabled,
  }: {
    enabled?: boolean;
  } = {}
) => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  return useQuery({
    ...trpc.project.getById.queryOptions({
      id: projectId ?? "",
    }),
    enabled: (enabled ?? true) && !!session?.user && !!projectId,
  });
};
export const useGetChatMessagesQueryOptions = (chatId: string) => {
  const { data: session } = useSession();
  const trpc = useTRPC();
  return {
    ...trpc.chat.getChatMessages.queryOptions({ chatId: chatId || "" }),
    enabled: !!chatId && !!session?.user,
  };
};
export const useDeleteChat = () => {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const qc = useQueryClient();
  const allChatsKey = trpc.chat.getAllChats.queryKey();
  const deleteMutation = useMutation({
    mutationFn: trpc.chat.deleteChat.mutationOptions().mutationFn,
    onError: (
      _err,
      _vars,
      ctx: { previousAllChats?: [QueryKey, UIChat[] | undefined][] } | undefined
    ) => {
      if (ctx?.previousAllChats) {
        restoreAllChatsQueries(qc, ctx.previousAllChats);
      }
    },
    onMutate: async ({
      chatId,
    }): Promise<{
      previousAllChats?: [QueryKey, UIChat[] | undefined][];
    }> => {
      if (!isAuthenticated) {
        return { previousAllChats: undefined };
      }
      const snapshot = snapshotAllChatsQueries(qc, allChatsKey);
      await qc.cancelQueries({ exact: false, queryKey: allChatsKey });
      updateAllChatsQueries(
        qc,
        allChatsKey,
        (old) => old?.filter((c) => c.id !== chatId) ?? old
      );
      return { previousAllChats: snapshot };
    },
    onSettled: () => {
      qc.invalidateQueries({ exact: false, queryKey: allChatsKey });
    },
  });
  const deleteChat = useCallback(
    async (
      chatId: string,
      options?: {
        onSuccess?: () => void;
        onError?: (error: Error) => void;
      }
    ) => {
      if (!isAuthenticated) {
        return;
      }
      try {
        await deleteMutation.mutateAsync({ chatId });
        options?.onSuccess?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        options?.onError?.(err);
        throw err;
      }
    },
    [deleteMutation, isAuthenticated]
  );
  return { deleteChat };
};
export const useRenameChat = () => {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const qc = useQueryClient();
  const trpc = useTRPC();
  const allChatsKey = trpc.chat.getAllChats.queryKey();
  return useMutation({
    mutationFn: trpc.chat.renameChat.mutationOptions().mutationFn,
    onError: (
      _err,
      { chatId },
      ctx:
        | {
            previousAllChats?: [QueryKey, UIChat[] | undefined][];
            previousChatById?: UIChat | null;
          }
        | undefined
    ) => {
      if (ctx?.previousAllChats) {
        restoreAllChatsQueries(qc, ctx.previousAllChats);
      }
      if (ctx?.previousChatById !== undefined) {
        qc.setQueryData(
          trpc.chat.getChatById.queryKey({ chatId }),
          ctx.previousChatById ?? undefined
        );
      }
      toast.error("Failed to rename chat");
    },
    onMutate: async ({
      chatId,
      title,
    }): Promise<{
      previousAllChats?: [QueryKey, UIChat[] | undefined][];
      previousChatById?: UIChat | null;
    }> => {
      if (!isAuthenticated) {
        return { previousAllChats: undefined, previousChatById: undefined };
      }
      const byIdKey = trpc.chat.getChatById.queryKey({ chatId });
      await Promise.all([
        qc.cancelQueries({ exact: false, queryKey: allChatsKey }),
        qc.cancelQueries({ queryKey: byIdKey }),
      ]);
      const previousAllChats = snapshotAllChatsQueries(qc, allChatsKey);
      const previousChatById = qc.getQueryData<UIChat | null>(byIdKey);
      updateAllChatsQueries(
        qc,
        allChatsKey,
        (old) => old?.map((c) => (c.id === chatId ? { ...c, title } : c)) ?? old
      );
      if (previousChatById) {
        qc.setQueryData<UIChat | null>(byIdKey, (old) =>
          old ? { ...old, title } : old
        );
      }
      return { previousAllChats, previousChatById };
    },
    onSettled: async (_data, _error, { chatId }) => {
      await Promise.all([
        qc.invalidateQueries({ exact: false, queryKey: allChatsKey }),
        qc.invalidateQueries({
          queryKey: trpc.chat.getChatById.queryKey({ chatId }),
        }),
      ]);
    },
  });
};
export const useRenameProject = () => {
  const qc = useQueryClient();
  const trpc = useTRPC();
  return useMutation({
    ...trpc.project.update.mutationOptions(),
    onError: (
      _error,
      _variables,
      ctx: { previous: Project[] | undefined } | undefined
    ) => {
      if (ctx?.previous) {
        qc.setQueryData(trpc.project.list.queryKey(), ctx.previous);
      }
      toast.error("Failed to rename project");
    },
    onMutate: async (variables) => {
      const listKey = trpc.project.list.queryKey();
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Project[]>(listKey);
      const nextName =
        typeof variables.updates.name === "string"
          ? variables.updates.name
          : undefined;
      if (nextName) {
        qc.setQueryData<Project[] | undefined>(listKey, (old) =>
          old?.map((p) =>
            p.id === variables.id ? { ...p, name: nextName } : p
          )
        );
      }
      return { previous };
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: trpc.project.list.queryKey() }),
    onSuccess: () => toast.success("Project renamed"),
  });
};
export const usePinChat = () => {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const qc = useQueryClient();
  const allChatsKey = trpc.chat.getAllChats.queryKey();
  return useMutation({
    mutationFn: trpc.chat.setIsPinned.mutationOptions().mutationFn,
    onError: (
      _err,
      _vars,
      ctx: { previousAllChats?: [QueryKey, UIChat[] | undefined][] } | undefined
    ) => {
      if (ctx?.previousAllChats) {
        restoreAllChatsQueries(qc, ctx.previousAllChats);
      }
      toast.error("Failed to pin chat");
    },
    onMutate: async ({
      chatId,
      isPinned,
    }): Promise<{
      previousAllChats?: [QueryKey, UIChat[] | undefined][];
    }> => {
      if (!isAuthenticated) {
        return { previousAllChats: undefined };
      }
      const snapshot = snapshotAllChatsQueries(qc, allChatsKey);
      await qc.cancelQueries({ exact: false, queryKey: allChatsKey });
      updateAllChatsQueries(
        qc,
        allChatsKey,
        (old) =>
          old?.map((c) => (c.id === chatId ? { ...c, isPinned } : c)) ?? old
      );
      return { previousAllChats: snapshot };
    },
    onSettled: async (_data, _error, { chatId }) => {
      await Promise.all([
        qc.invalidateQueries({ exact: false, queryKey: allChatsKey }),
        qc.invalidateQueries({
          queryKey: trpc.chat.getChatById.queryKey({ chatId }),
        }),
      ]);
    },
  });
};
export const useCloneChat = () => {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const allChatsKey = trpc.chat.getAllChats.queryKey();
  return useMutation({
    ...trpc.chat.cloneSharedChat.mutationOptions(),
    onError: (error) => console.error("Failed to copy chat:", error),
    onSettled: () => qc.refetchQueries({ exact: false, queryKey: allChatsKey }),
  });
};
const acknowledgeSavedMessage: (input: {
  message: ChatMessage;
  chatId: string;
}) => Promise<{
  readonly success: true;
}> = () => Promise.resolve({ success: true });
export const useSaveMessageMutation = () => {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const qc = useQueryClient();
  return useMutation({
    // Message is saved in the backend by another route. This doesn't need to actually mutate
    mutationFn: acknowledgeSavedMessage,
    onMutate: async ({ message, chatId }) => {
      const key = trpc.chat.getChatMessages.queryKey({ chatId });
      await qc.cancelQueries({ queryKey: key });
      const previousMessages = qc.getQueryData<ChatMessage[]>(key);
      qc.setQueryData<ChatMessage[]>(key, (old) =>
        old ? [...old, message] : [message]
      );
      return { chatId, previousMessages };
    },
    onSettled: (_data, _error, { message, chatId }) => {
      if (message.role === "assistant" && isAuthenticated) {
        // Sync the full message tree after the mutation settles so parallel
        // response siblings get their updated activeStreamId from the server.
        // Placed in onSettled (not onSuccess) so this runs after the real
        // backend write when the mutationFn is eventually made server-side.
        const key = trpc.chat.getChatMessages.queryKey({ chatId });
        qc.invalidateQueries({ queryKey: key });
      }
    },
    onSuccess: async (_data, { message, chatId }) => {
      if (message.role === "assistant") {
        if (isAuthenticated) {
          qc.invalidateQueries({
            queryKey: trpc.credits.getAvailableCredits.queryKey(),
          });
          await Promise.all([
            qc.invalidateQueries({
              exact: false,
              queryKey: trpc.chat.getAllChats.queryKey(),
            }),
            qc.invalidateQueries({
              queryKey: trpc.chat.getChatById.queryKey({ chatId }),
            }),
          ]);
        } else {
          // Refresh anonymous credits from cookie
          qc.invalidateQueries({ queryKey: ANONYMOUS_CREDITS_KEY });
        }
      }
    },
  });
};
export const useSetVisibility = () => {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return useMutation({
    ...trpc.chat.setVisibility.mutationOptions(),
    onError: () => toast.error("Failed to update chat visibility"),
    onSettled: () =>
      qc.invalidateQueries({
        exact: false,
        queryKey: trpc.chat.getAllChats.queryKey(),
      }),
    onSuccess: (_data, { visibility }) => {
      toast.success(
        visibility === "public"
          ? "Chat is now public - anyone with the link can access it"
          : "Chat is now private - only you can access it"
      );
    },
  });
};
export const useSaveDocument = (
  _documentId: string,
  messageId: string,
  options?: {
    onSettled?: (result: unknown, error: unknown, params: unknown) => void;
  }
) => {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  return useMutation({
    mutationFn: trpc.document.saveDocument.mutationOptions().mutationFn,
    onError: (
      _err,
      newDoc,
      ctx: { previousDocuments: Document[] } | undefined
    ) => {
      if (ctx?.previousDocuments) {
        qc.setQueryData(
          trpc.document.getDocuments.queryKey({ id: newDoc.id }),
          ctx.previousDocuments
        );
      }
    },
    onMutate: async (
      newDoc
    ): Promise<{
      previousDocuments: Document[];
    }> => {
      const key = trpc.document.getDocuments.queryKey({ id: newDoc.id });
      await qc.cancelQueries({ queryKey: key });
      const previousDocuments = qc.getQueryData<Document[]>(key) ?? [];
      qc.setQueryData(key, [
        ...previousDocuments,
        {
          content: newDoc.content,
          createdAt: new Date(),
          id: newDoc.id,
          kind: newDoc.kind,
          messageId,
          title: newDoc.title,
          userId: userId || "",
        } as Document,
      ]);
      return { previousDocuments };
    },
    onSettled: (result, error, params) => {
      qc.invalidateQueries({
        queryKey: trpc.document.getDocuments.queryKey({ id: params.id }),
      });
      options?.onSettled?.(result, error, params);
    },
  });
};
export const useDocuments = (id: string, disable: boolean) => {
  const trpc = useTRPC();
  const { source } = useCurrentChatRoute();
  const isShared = source === "share";
  const { data: session } = useSession();
  return useQuery({
    ...(isShared
      ? trpc.document.getPublicDocuments.queryOptions({ id })
      : trpc.document.getDocuments.queryOptions({ id })),
    enabled: !disable && !!id && (isShared || !!session?.user),
  });
};
export const useGetAllChats = (opts?: {
  projectId?: string | null;
  limit?: number;
}) => {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const { projectId, limit } = opts ?? {};
  return useQuery({
    ...trpc.chat.getAllChats.queryOptions({
      projectId: projectId ?? null,
    }),
    enabled: !!session?.user,
    select: limit ? (data: UIChat[]) => data.slice(0, limit) : undefined,
  });
};
export const useGetChatByIdQueryOptions = (chatId?: string | null) => {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const normalizedChatId = chatId ?? "";
  return {
    ...trpc.chat.getChatById.queryOptions({ chatId: normalizedChatId }),
    enabled: !!normalizedChatId && !!session?.user,
  };
};
export const useGetChatById = (
  chatId?: string | null,
  {
    enabled,
  }: {
    enabled?: boolean;
  } = {}
) => {
  const options = useGetChatByIdQueryOptions(chatId);
  return useQuery({
    ...options,
    enabled: (enabled ?? true) && (options.enabled ?? true),
  });
};
export const useGetCredits = () => {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const { data: creditsData, isLoading: isLoadingCredits } = useQuery({
    ...trpc.credits.getAvailableCredits.queryOptions(),
    enabled: isAuthenticated,
  });
  // Use a query for anonymous credits so we can invalidate it
  const { data: anonymousCredits } = useQuery({
    enabled: !isAuthenticated,
    queryFn: () => {
      const anonymousSession = getAnonymousSession();
      return anonymousSession?.remainingCredits ?? ANONYMOUS_LIMITS.CREDITS;
    },
    queryKey: ANONYMOUS_CREDITS_KEY,
    staleTime: 0,
  });
  if (!isAuthenticated) {
    return {
      credits: anonymousCredits ?? ANONYMOUS_LIMITS.CREDITS,
      isLoadingCredits: false,
    };
  }
  return {
    credits: creditsData?.credits,
    isLoadingCredits,
  };
};
