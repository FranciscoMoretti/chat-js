"use client";

import { useQuery } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { ChevronDown, Share } from "lucide-react";
/* oxlint-enable sort-imports */
import React, { useState } from "react";
import type { JSX as ReactJSX } from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ChatHeaderView } from "@/components/chat-header-view";
/* oxlint-enable sort-imports */
import { ChatMenuItems } from "@/components/chat-menu-items";
import { InternalLink } from "@/components/internal-link";
import { ProjectIcon } from "@/components/project-icon";
import { ShareDialog } from "@/components/share-button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- @/components/ui/dropdown-menu import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/* oxlint-enable import/max-dependencies */
import { Input } from "@/components/ui/input";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { PROJECT_COLORS, PROJECT_ICONS } from "@/lib/project-icons";
/* oxlint-enable sort-imports */
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { useEveDeletion } from "./eve-deletion-provider";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { EveShareButton, EveShareDialogContent } from "./eve-share-dialog";
/* oxlint-enable sort-imports */
import { useEveMetadataMutations } from "./use-eve-metadata-mutations";
/* oxlint-disable react/jsx-no-literals -- EveSharedBadge renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable react/jsx-max-depth -- EveSharedBadge: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

const EveSharedBadge = (): React.JSX.Element => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="bg-muted/50 text-muted-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-sm">
        <Share
          // oxlint-disable-next-line react/forbid-component-props -- Share accepts className in its styling contract; preserve this caller's layout and appearance.
          className="opacity-70"
          size={14}
        />
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- projectAppearance: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including project: { icon: string; iconColor: string } | undefined). */

const projectAppearance = (
  project: { icon: string; iconColor: string } | undefined
) => ({
  color:
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from PROJECT_COLORS.find(...); preserve one receiver evaluation, skipped accesses and the existing "gray" fallback. The app guidance prefers optional chaining. Keep the existing nullish guard when reading iconColor from project; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    PROJECT_COLORS.find((value) => value.name === project?.iconColor)?.name ??
    "gray",
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading icon from project; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  icon: PROJECT_ICONS.find((value) => value === project?.icon) ?? "folder",
});
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- EveChatHeader: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including projectId); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const EveChatHeader = ({
  chatId,
  conversationId,
  fallbackTitle,
  hasMessages,
}: {
  readonly chatId: string;
  readonly conversationId: string;
  readonly fallbackTitle: string;
  readonly hasMessages: boolean;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const identity = useQuery(trpc.eve.get.queryOptions({ id: chatId }));
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading projectId from identity.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const projectId = identity.data?.projectId;
  const project = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId ?? "" },
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      { enabled: Boolean(projectId && session?.user) }
    )
  );
  const { rename, pin } = useEveMetadataMutations();
  const openDeletion = useEveDeletion();
  const [draft, setDraft] = useState<string>();
  const [sharing, setSharing] = useState(false);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading title from identity.data; preserve one receiver evaluation, skipped accesses and the existing fallbackTitle fallback. The app guidance prefers optional chaining.
  const title = identity.data?.title ?? fallbackTitle;
  const save = (): void => {
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
              // oxlint-disable-next-line react/forbid-component-props -- EveShareButton accepts className in its styling contract; preserve this caller's layout and appearance.
              className="hidden md:flex"
            />
          )
        }
        breadcrumb={
          <Breadcrumb
            // oxlint-disable-next-line react/forbid-component-props -- Breadcrumb accepts className in its styling contract; preserve this caller's layout and appearance.
            className="ml-2 min-w-0"
          >
            <BreadcrumbList
              // oxlint-disable-next-line react/forbid-component-props -- BreadcrumbList accepts className in its styling contract; preserve this caller's layout and appearance.
              className="flex-nowrap"
            >
              {projectId /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */ &&
                session?.user && (
                  /* oxlint-enable oxc/no-optional-chaining */ <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <InternalLink
                          aria-label={
                            /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from project.data; preserve one receiver evaluation, skipped accesses and the existing "Project" fallback. The app guidance prefers optional chaining. */
                            project.data?.name ??
                            /* oxlint-enable oxc/no-optional-chaining */ "Project"
                          }
                          title={
                            /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from project.data; preserve one receiver evaluation, skipped accesses and the existing "Project" fallback. The app guidance prefers optional chaining. */
                            project.data?.name ??
                            /* oxlint-enable oxc/no-optional-chaining */ "Project"
                          }
                          href={`/project/${projectId}`}
                        >
                          <ProjectIcon icon={icon} color={color} size={16} />
                        </InternalLink>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                )}
              <BreadcrumbItem
                // oxlint-disable-next-line react/forbid-component-props -- BreadcrumbItem accepts className in its styling contract; preserve this caller's layout and appearance.
                className="min-w-0"
              >
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  draft === undefined ? (
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
                            // oxlint-disable-next-line react/forbid-component-props -- ChevronDown accepts className in its styling contract; preserve this caller's layout and appearance.
                            className="text-muted-foreground size-4 shrink-0"
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <ChatMenuItems
                          isPinned={
                            /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading isPinned from identity.data; preserve one receiver evaluation, skipped accesses and the existing false fallback. The app guidance prefers optional chaining. */
                            identity.data?.isPinned ??
                            /* oxlint-enable oxc/no-optional-chaining */ false
                          }
                          onRename={() => setDraft(title)}
                          onTogglePin={() =>
                            pin.mutate({
                              id: chatId,
                              // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading isPinned from identity.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
                      // oxlint-disable-next-line react/forbid-component-props -- Input accepts className in its styling contract; preserve this caller's layout and appearance.
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
                  )
                }
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveChatHeader, EveSharedBadge); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
export { EveChatHeader, EveSharedBadge };
/* oxlint-enable import/no-named-export */
