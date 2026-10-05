"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useState } from "react";
/* oxlint-enable sort-imports */

import { ChatHeaderView } from "@/components/chat-header-view";
import { ProjectConfig } from "@/components/project-config";
import { ProjectDetailsDialog } from "@/components/project-details-dialog";
import { ProjectInstructionsDialog } from "@/components/project-instructions-dialog";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
import { useRenameProject } from "@/hooks/use-projects";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { listEveConversations } from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { Project } from "@/lib/db/schema";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- @/lib/project-icons import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  PROJECT_COLORS,
  PROJECT_ICONS,
} from "@/lib/project-icons";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveHistoryList } from "./eve-history-list";
/* oxlint-enable sort-imports */
import { NewEveConversation } from "./new-eve-conversation";
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveProjectHome: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including page); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveProjectHome = ({
  ownerId,
  initialProject,
  initialPage,
}: {
  ownerId: string;
  initialProject: Project;
  initialPage: Awaited<ReturnType<typeof listEveConversations>>;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const project = useQuery(
    trpc.project.getById.queryOptions(
      { id: initialProject.id },
      { initialData: initialProject }
    )
  );
  const [sending, setSending] = useState(false);
  const history = useInfiniteQuery(
    trpc.eve.list.infiniteQueryOptions(
      { ownerScope: ownerId, projectId: initialProject.id, search: "" },
      {
        getNextPageParam: (page) => page.nextCursor,
        initialData: { pageParams: [null], pages: [initialPage] },
      }
    )
  );
  const shouldCenter = history.data.pages.every(
    (page) => page.items.length === 0
  );
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve refresh's awaited sequencing and rejected-Promise behavior. */
  const refresh = async (): Promise<void> => {
    await cache.invalidateQueries({ queryKey: trpc.project.pathKey() });
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve save's awaited sequencing and rejected-Promise behavior. */
  const save = useMutation(
    trpc.project.setInstructions.mutationOptions({
      onSuccess: async () => {
        await refresh();
        setInstructionsOpen(false);
      },
    })
  );
  /* oxlint-enable oxc/no-async-await */
  const rename = useRenameProject();
  const contentPosition = shouldCenter ? "row-start-2" : "mt-4";
  const current = project.data;
  const icon =
    PROJECT_ICONS.find((value) => value === current.icon) ??
    DEFAULT_PROJECT_ICON;
  const color =
    PROJECT_COLORS.find((value) => value.name === current.iconColor)?.name ??
    DEFAULT_PROJECT_COLOR;
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return (
    <section className="@container flex h-full min-h-0 flex-col">
      <ChatHeaderView breadcrumb={null} />
      <div className="flex flex-1 justify-center overflow-y-auto">
        <div
          className={cn(
            "mx-auto flex h-full min-h-0 w-full flex-col p-2 md:max-w-3xl @[500px]:px-4 @[500px]:pb-4 @[500px]:md:pb-6",
            shouldCenter && !sending && "grid grid-rows-[1fr_auto_1fr]"
          )}
        >
          <div
            className={cn(
              "space-y-4",
              sending ? "flex min-h-0 flex-1 flex-col" : contentPosition
            )}
          >
            {project.isError && (
              <div role="alert">
                <p>Could not refresh this project.</p>
                <Button
                  onClick={() => {
                    void project.refetch();
                  }}
                  variant="outline"
                >
                  Retry project
                </Button>
              </div>
            )}
            {!sending && (
              <ProjectConfig
                instructions={current.instructions}
                onEditInstructions={() => {
                  save.reset();
                  setInstructions(current.instructions ?? "");
                  setInstructionsOpen(true);
                }}
                onRenameProject={() => {
                  rename.reset();
                  setRenameOpen(true);
                }}
                projectColor={color}
                projectIcon={icon}
                projectName={current.name}
              />
            )}
            <NewEveConversation
              key={`${ownerId}:${current.id}`}
              ownerId={ownerId}
              projectId={current.id}
              onPendingChange={setSending}
            />
          </div>
          <div
            className={cn(
              sending && "hidden",
              shouldCenter ? "row-start-3 mt-6" : "mt-4 min-h-0 flex-1"
            )}
          >
            <EveHistoryList
              initialPage={initialPage}
              ownerId={ownerId}
              projectId={current.id}
            />
          </div>
          <ProjectInstructionsDialog
            error={
              save.error ? "Could not save instructions. Try again." : undefined
            }
            isPending={save.isPending}
            onOpenChange={setInstructionsOpen}
            onSave={() => save.mutate({ id: current.id, instructions })}
            onValueChange={setInstructions}
            open={instructionsOpen}
            projectName={current.name}
            value={instructions}
          />
          <ProjectDetailsDialog
            initialColor={color}
            initialIcon={icon}
            initialName={current.name}
            isLoading={rename.isPending}
            mode="edit"
            onOpenChange={setRenameOpen}
            onSubmit={async (value) => {
              await rename.mutateAsync({
                id: current.id,
                updates: {
                  icon: value.icon,
                  iconColor: value.color,
                  name: value.name,
                },
              });
            }}
            open={renameOpen}
          />
        </div>
      </div>
    </section>
  );
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, unicorn/no-null */
