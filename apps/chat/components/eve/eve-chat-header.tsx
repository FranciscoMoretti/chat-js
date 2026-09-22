"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Share } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ChatHeaderView } from "@/components/chat-header-view";
import { ChatMenuItems } from "@/components/chat-menu-items";
import { InternalLink } from "@/components/internal-link";
import { ProjectIcon } from "@/components/project-icon";
import { ShareDialog } from "@/components/share-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PROJECT_ICONS, PROJECT_COLORS } from "@/lib/project-icons";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

import { useEveDeletion } from "./eve-deletion-provider";
import { EveShareButton, EveShareDialogContent } from "./eve-share-dialog";
import { useEveMetadataMutations } from "./use-eve-metadata-mutations";

export const EveSharedBadge = () => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="bg-muted/50 text-muted-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-sm">
        <Share className="opacity-70" size={14} />
        <span>Shared</span>
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <div className="text-center">
        <div className="font-medium">Shared Chat</div>
        <div className="text-muted-foreground mt-1 text-xs">
          This is a shared chat
        </div>
      </div>
    </TooltipContent>
  </Tooltip>
);

const projectAppearance = (
  project: { icon: string; iconColor: string } | undefined
) => ({
  color:
    PROJECT_COLORS.find((value) => value.name === project?.iconColor)?.name ??
    "gray",
  icon: PROJECT_ICONS.find((value) => value === project?.icon) ?? "folder",
});

export const EveChatHeader = ({
  chatId,
  conversationId,
  fallbackTitle,
  hasMessages,
}: {
  chatId: string;
  conversationId: string;
  fallbackTitle: string;
  hasMessages: boolean;
}) => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const identity = useQuery(trpc.eve.get.queryOptions({ id: chatId }));
  const projectId = identity.data?.projectId;
  const project = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId ?? "" },
      { enabled: Boolean(projectId && session?.user) }
    )
  );
  const { rename, pin } = useEveMetadataMutations();
  const openDeletion = useEveDeletion();
  const [draft, setDraft] = useState<string>();
  const [sharing, setSharing] = useState(false);
  const title = identity.data?.title ?? fallbackTitle;
  const save = () => {
    if (draft === undefined) {
      return;
    }
    const next = draft.trim();
    setDraft(undefined);
    if (next && next !== title) {
      rename.mutate(
        { id: chatId, title: next },
        { onSuccess: () => toast.success("Chat renamed successfully") }
      );
    }
  };
  const { icon, color } = projectAppearance(project.data);
  return (
    <>
      <ChatHeaderView
        actions={
          hasMessages && (
            <EveShareButton
              chatId={conversationId}
              className="hidden md:flex"
            />
          )
        }
        breadcrumb={
          <Breadcrumb className="ml-2 min-w-0">
            <BreadcrumbList className="flex-nowrap">
              {projectId && session?.user && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <InternalLink
                        aria-label={project.data?.name ?? "Project"}
                        title={project.data?.name ?? "Project"}
                        href={`/project/${projectId}`}
                      >
                        <ProjectIcon icon={icon} color={color} size={16} />
                      </InternalLink>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem className="min-w-0">
                {draft === undefined ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label={`Chat menu: ${title}`}
                        className="group text-foreground hover:bg-muted focus-visible:ring-ring flex min-w-0 items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium transition focus-visible:ring-1 focus-visible:outline-none"
                        type="button"
                      >
                        <span className="truncate">{title}</span>
                        <ChevronDown
                          aria-hidden
                          className="text-muted-foreground size-4 shrink-0"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ChatMenuItems
                        isPinned={identity.data?.isPinned ?? false}
                        onRename={() => setDraft(title)}
                        onTogglePin={() =>
                          pin.mutate({
                            id: chatId,
                            isPinned: !identity.data?.isPinned,
                          })
                        }
                        onDelete={() =>
                          openDeletion({
                            id: chatId,
                            projectId: projectId ?? null,
                            state: "bound",
                            title,
                          })
                        }
                        onShare={() => setSharing(true)}
                        showShare={hasMessages}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Input
                    aria-label="Chat title"
                    autoFocus
                    className="bg-background h-7 w-[220px] px-2 py-1 text-sm"
                    maxLength={255}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={save}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        save();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setDraft(undefined);
                      }
                    }}
                  />
                )}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />
      <ShareDialog
        open={sharing}
        onOpenChange={setSharing}
        renderContent={(onClose) => (
          <EveShareDialogContent chatId={conversationId} onClose={onClose} />
        )}
      />
    </>
  );
};
