"use client";
import { ChevronDown } from "lucide-react";
import { memo, useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { toast } from "sonner";

import { ChatMenuItems } from "@/components/chat-menu-items";
import { DeleteChatDialog } from "@/components/delete-chat-dialog";
import { InternalLink } from "@/components/internal-link";
import { ProjectIcon } from "@/components/project-icon";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { usePinChat, useProject, useRenameChat } from "@/hooks/chat-sync-hooks";
import { usePublicChat } from "@/hooks/use-shared-chat";
import type { Session } from "@/lib/auth";
import type { ChatRouteSource } from "@/lib/chat-route";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
import type { UIChat } from "@/lib/types/ui-chat";
import { cn } from "@/lib/utils";

import { ShareDialog } from "./share-button";

interface HeaderBreadcrumbProps {
  chat?: UIChat | null;
  chatId: string;
  className?: string;
  hasMessages?: boolean;
  isReadonly: boolean;
  projectId?: string;
  routeSource: ChatRouteSource;
  user?: Session["user"];
}

export const HeaderBreadcrumb = ({
  chat,
  chatId,
  user,
  isReadonly,
  hasMessages,
  className,
  routeSource,
}: HeaderBreadcrumbProps) => {
  const isShared = routeSource === "share";
  const isAuthenticated = !!user;

  const { data: publicChat } = usePublicChat(chatId, {
    enabled: isShared,
  });

  const resolvedProjectId = chat?.projectId ?? publicChat?.projectId ?? null;

  const { data: project, isFetching: isProjectLoading } = useProject(
    resolvedProjectId,
    { enabled: isAuthenticated && Boolean(resolvedProjectId) }
  );

  const chatLabel = chat?.title ?? publicChat?.title ?? "";
  const shouldHideBreadcrumb = !chatLabel;

  const projectLabel = resolvedProjectId
    ? (project?.name ?? (isProjectLoading ? "Loading project…" : undefined))
    : undefined;
  const [isChatEditing, setIsChatEditing] = useState(false);
  const [chatTitleDraft, setChatTitleDraft] = useState("");
  const [chatDeleteId, setChatDeleteId] = useState<string | null>(null);
  const [showChatDeleteDialog, setShowChatDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const { mutate: pinChatMutation } = usePinChat();
  const { mutateAsync: renameChatMutation } = useRenameChat();

  useSyncDraftValue({
    isEditing: isChatEditing,
    setDraft: setChatTitleDraft,
    value: chat?.title,
  });

  if (!(chat || publicChat)) {
    return null;
  }

  const canManageChat = !isReadonly && !!chat;

  const handlePinToggle = () => {
    pinChatMutation({ chatId, isPinned: !chat?.isPinned });
  };

  const handleChatRename = () =>
    performChatRename({
      chatId,
      chatTitleDraft,
      privateChat: chat,
      renameChat: renameChatMutation,
      setChatTitleDraft,
      setIsChatEditing,
    });

  const handleChatInputKeyDown = createInputKeyDownHandler({
    onEnter: () => {
      handleChatRename().catch(() => {
        // No-op: already handled via rename hook
      });
    },
    onEscape: () => {
      setIsChatEditing(false);
      setChatTitleDraft(chat?.title ?? "");
    },
  });

  const openChatDeleteDialog = () => {
    setChatDeleteId(chatId);
    setShowChatDeleteDialog(true);
  };

  const startChatRename = () => {
    setIsChatEditing(true);
    setChatTitleDraft(chat?.title ?? "");
  };

  if (shouldHideBreadcrumb) {
    return null;
  }

  return (
    <>
      <Breadcrumb className={cn("min-w-0", className)}>
        <BreadcrumbList className="flex-nowrap">
          <ProjectBreadcrumb
            projectColor={project?.iconColor as ProjectColorName | undefined}
            projectIcon={project?.icon as ProjectIconName | undefined}
            projectId={resolvedProjectId}
            projectLabel={projectLabel}
          />
          <BreadcrumbItem className="min-w-0">
            {
              <PureChatBreadcrumb
                canManageChat={canManageChat}
                chatLabel={chatLabel}
                chatTitleDraft={chatTitleDraft}
                handleChatInputKeyDown={handleChatInputKeyDown}
                handleChatRename={handleChatRename}
                isChatEditing={isChatEditing}
                isPinned={!!chat?.isPinned}
                onChatTitleChange={(value: string) => setChatTitleDraft(value)}
                onShare={() => setShowShareDialog(true)}
                onTogglePin={handlePinToggle}
                openChatDeleteDialog={openChatDeleteDialog}
                showShare={!!hasMessages}
                startChatRename={startChatRename}
              />
            }
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <DeleteChatDialog
        deleteId={chatDeleteId}
        setShowDeleteDialog={setShowChatDeleteDialog}
        showDeleteDialog={showChatDeleteDialog}
      />

      <ShareDialog
        chatId={chatId}
        onOpenChange={setShowShareDialog}
        open={showShareDialog}
      />
    </>
  );
};

interface ChatBreadcrumbProps {
  canManageChat: boolean;
  chatLabel: string;
  chatTitleDraft: string;
  handleChatInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleChatRename: () => Promise<void> | void;
  isChatEditing: boolean;
  isPinned: boolean;
  onChatTitleChange: (value: string) => void;
  onShare: () => void;
  onTogglePin: () => void;
  openChatDeleteDialog: () => void;
  showShare?: boolean;
  startChatRename: () => void;
}

const PureChatBreadcrumb = memo(function InnerChatBreadcrumb({
  canManageChat,
  chatLabel,
  chatTitleDraft,
  handleChatInputKeyDown,
  handleChatRename,
  isChatEditing,
  isPinned,
  onChatTitleChange,
  onShare,
  onTogglePin,
  openChatDeleteDialog,
  showShare,
  startChatRename: startChatRenameProp,
}: ChatBreadcrumbProps) {
  if (isChatEditing) {
    return (
      <Input
        autoFocus
        className="bg-background h-7 w-[220px] px-2 py-1 text-sm"
        maxLength={255}
        onBlur={handleChatRename}
        onChange={(event) => onChatTitleChange(event.target.value)}
        onKeyDown={handleChatInputKeyDown}
        value={chatTitleDraft}
      />
    );
  }

  if (canManageChat) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="group text-foreground hover:bg-muted focus-visible:ring-ring flex min-w-0 items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium transition focus-visible:ring-1 focus-visible:outline-none"
            type="button"
          >
            <span className="truncate">{chatLabel}</span>
            <ChevronDown
              aria-hidden
              className="text-muted-foreground size-4 shrink-0"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ChatMenuItems
            isPinned={isPinned}
            onDelete={openChatDeleteDialog}
            onRename={startChatRenameProp}
            onShare={onShare}
            onTogglePin={onTogglePin}
            showShare={showShare}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return <BreadcrumbPage>{chatLabel}</BreadcrumbPage>;
});

interface PerformChatRenameArgs {
  chatId: string;
  chatTitleDraft: string;
  privateChat: { title?: string; isPinned?: boolean } | null | undefined;
  renameChat: (args: { chatId: string; title: string }) => Promise<unknown>;
  setChatTitleDraft: (value: string) => void;
  setIsChatEditing: (value: boolean) => void;
}

const performChatRename = async ({
  chatId,
  chatTitleDraft,
  privateChat,
  renameChat,
  setChatTitleDraft,
  setIsChatEditing,
}: PerformChatRenameArgs) => {
  if (!privateChat) {
    setIsChatEditing(false);
    return;
  }
  const trimmed = chatTitleDraft.trim();
  if (!trimmed || trimmed === privateChat.title) {
    setIsChatEditing(false);
    setChatTitleDraft(privateChat.title ?? "");
    return;
  }
  try {
    await renameChat({ chatId, title: trimmed });
    toast.success("Chat renamed successfully");
  } catch {
    // Errors handled in hook
  } finally {
    setIsChatEditing(false);
  }
};

interface InputKeyHandlerOptions {
  onEnter: () => void;
  onEscape: () => void;
}

const createInputKeyDownHandler =
  ({ onEnter, onEscape }: InputKeyHandlerOptions) =>
  (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onEnter();
      return;
    }
    if (event.key === "Escape") {
      onEscape();
    }
  };

const useSyncDraftValue = ({
  isEditing,
  setDraft,
  value,
}: {
  isEditing: boolean;
  setDraft: (val: string) => void;
  value: string | undefined;
}) => {
  useEffect(() => {
    if (!isEditing) {
      setDraft(value ?? "");
    }
  }, [isEditing, setDraft, value]);
};

const ProjectBreadcrumb = ({
  projectLabel,
  projectId,
  projectIcon,
  projectColor,
}: {
  projectLabel?: string;
  projectId: string | null;
  projectIcon?: ProjectIconName;
  projectColor?: ProjectColorName;
}) => {
  if (!(projectLabel && projectId)) {
    return null;
  }

  return (
    <>
      <BreadcrumbItem>
        <BreadcrumbLink asChild>
          <InternalLink
            aria-label={projectLabel}
            className="flex items-center"
            href={`/project/${projectId}`}
            title={projectLabel}
          >
            {projectIcon && projectColor ? (
              <ProjectIcon color={projectColor} icon={projectIcon} size={16} />
            ) : (
              projectLabel
            )}
          </InternalLink>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
    </>
  );
};
