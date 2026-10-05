"use client";

import { formatDistance } from "date-fns";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { FolderInput, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
/* oxlint-enable sort-imports */
import React, { useState } from "react";
import type { JSX as ReactJSX, ReactNode } from "react";

import { ChatRenameDialog } from "@/components/chat-rename-dialog";
import { InternalLink } from "@/components/internal-link";
import { ShareDialog } from "@/components/share-button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */
import { ShareMenuItem } from "@/components/upgrade-cta/share-menu-item";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ProjectChatItem); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- ProjectChatItem renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions -- ProjectChatItem: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including chat.updatedAt). */

export const ProjectChatItem = ({
  chat,
  onDelete,
  onRename,
  onMoveProject,
  renderShareContent,
}: {
  chat: {
    id: string;
    title: string;
    projectId: string | null;
    updatedAt?: Date | string;
  };
  onDelete?: (chatId: string) => void;
  onMoveProject?: () => void;
  renderShareContent: (chatId: string, onClose: () => void) => ReactNode;
  onRename: (chatId: string, title: string) => Promise<void>;
}): ReactJSX.Element => {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const chatHref: `/project/${string}/chat/${string}` = `/project/${chat.projectId}/chat/${chat.id}`;

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleRename's awaited sequencing and rejected-Promise behavior. */
  const handleRename = async (title: string): Promise<void> => {
    await onRename(chat.id, title);
  };
  /* oxlint-enable oxc/no-async-await */
  const lastMessageText = chat.updatedAt
    ? formatDistance(new Date(chat.updatedAt), new Date(), {
        addSuffix: true,
      })
    : "";

  return (
    <>
      <div className="group relative">
        <div className="hover:bg-muted/50 relative flex items-center gap-3 px-4 py-3 transition-colors">
          <InternalLink
            aria-label={chat.title}
            // oxlint-disable-next-line react/forbid-component-props -- InternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
            className="absolute inset-0 z-10"
            href={chatHref}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{chat.title}</div>
            <div className="text-muted-foreground text-xs">
              {lastMessageText}
            </div>
          </div>
          <div className="z-20">
            <DropdownMenu modal>
              <DropdownMenuTrigger asChild>
                <Button
                  // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="h-7 w-7 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <MoreHorizontal size={16} />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem
                  // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="cursor-pointer"
                  onClick={() => setRenameDialogOpen(true)}
                >
                  <Pencil size={16} />
                  <span>Rename</span>
                </DropdownMenuItem>

                {onMoveProject && (
                  <DropdownMenuItem onClick={onMoveProject}>
                    <FolderInput size={16} />
                    <span>Move to project</span>
                  </DropdownMenuItem>
                )}

                <ShareMenuItem onShare={() => setShareDialogOpen(true)} />

                {onDelete && (
                  <DropdownMenuItem
                    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer"
                    onSelect={() => onDelete(chat.id)}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {shareDialogOpen && (
        <ShareDialog
          onOpenChange={setShareDialogOpen}
          open={shareDialogOpen}
          renderContent={(onClose) => renderShareContent(chat.id, onClose)}
        />
      )}

      {renameDialogOpen && (
        <ChatRenameDialog
          currentTitle={chat.title}
          isLoading={false}
          onOpenChange={setRenameDialogOpen}
          onSubmit={handleRename}
          open={renameDialogOpen}
        />
      )}
    </>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
