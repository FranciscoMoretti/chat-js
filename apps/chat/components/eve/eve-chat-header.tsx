"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Share } from "lucide-react";
import React, { useState } from "react";
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
/* oxlint-disable import/max-dependencies -- @/components/ui/dropdown-menu import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/* oxlint-enable import/max-dependencies */
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PROJECT_COLORS, PROJECT_ICONS } from "@/lib/project-icons";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

import { useEveDeletion } from "./eve-deletion-provider";
import { EveShareButton, EveShareDialogContent } from "./eve-share-dialog";
import { useEveMetadataMutations } from "./use-eve-metadata-mutations";
/* oxlint-disable import/exports-last, import/group-exports, react/jsx-max-depth -- EveSharedBadge: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

export const EveSharedBadge = (): React.JSX.Element => (
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
/* oxlint-enable import/exports-last, import/group-exports, react/jsx-max-depth */

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- projectAppearance: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including project: { icon: string; iconColor: string } | undefined). */

const projectAppearance = (
  project: { icon: string; iconColor: string } | undefined
) => ({
  color:
    PROJECT_COLORS.find((value) => value.name === project?.iconColor)?.name ??
    "gray",
  icon: PROJECT_ICONS.find((value) => value === project?.icon) ?? "folder",
});
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/group-exports, max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- EveChatHeader: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including projectId); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
        {
          onSuccess: () => {
            toast.success("Chat renamed successfully");
          },
        }
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
                    // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Choosing Rename replaces the title with this input and transfers keyboard focus into it.
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
        renderContent={(onClose): React.JSX.Element => (
          <EveShareDialogContent chatId={conversationId} onClose={onClose} />
        )}
      />
    </>
  );
};
/* oxlint-enable import/group-exports, max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
