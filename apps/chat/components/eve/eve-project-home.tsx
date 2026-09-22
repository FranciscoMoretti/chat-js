"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import { ChatHeaderView } from "@/components/chat-header-view";
import { ProjectConfig } from "@/components/project-config";
import { ProjectDetailsDialog } from "@/components/project-details-dialog";
import { ProjectInstructionsDialog } from "@/components/project-instructions-dialog";
import { Button } from "@/components/ui/button";
import { useRenameProject } from "@/hooks/use-projects";
import type { listEveConversations } from "@/lib/db/eve-queries";
import type { Project } from "@/lib/db/schema";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  PROJECT_COLORS,
  PROJECT_ICONS,
} from "@/lib/project-icons";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

import { EveHistoryList } from "./eve-history-list";
import { NewEveConversation } from "./new-eve-conversation";

export const EveProjectHome = ({
  ownerId,
  initialProject,
  initialPage,
}: {
  ownerId: string;
  initialProject: Project;
  initialPage: Awaited<ReturnType<typeof listEveConversations>>;
}) => {
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
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: trpc.project.pathKey() });
  };
  const save = useMutation(
    trpc.project.setInstructions.mutationOptions({
      onSuccess: async () => {
        await refresh();
        setInstructionsOpen(false);
      },
    })
  );
  const rename = useRenameProject();
  const contentPosition = shouldCenter ? "row-start-2" : "mt-4";
  const current = project.data;
  const icon =
    PROJECT_ICONS.find((value) => value === current.icon) ??
    DEFAULT_PROJECT_ICON;
  const color =
    PROJECT_COLORS.find((value) => value.name === current.iconColor)?.name ??
    DEFAULT_PROJECT_COLOR;
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
                <Button onClick={() => project.refetch()} variant="outline">
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
};
