"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ProjectConfig } from "@/components/project-config";
import { ProjectDetailsDialog } from "@/components/project-details-dialog";
import { ProjectInstructionsDialog } from "@/components/project-instructions-dialog";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { listEveConversations } from "@/lib/db/eve-queries";
import type { Project } from "@/lib/db/schema";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  PROJECT_COLORS,
  PROJECT_ICONS,
} from "@/lib/project-icons";
import { useTRPC } from "@/trpc/react";
import { EveHistoryList } from "./eve-history-list";
import { NewEveConversation } from "./new-eve-conversation";

export function EveProjectHome({
  ownerId,
  initialProject,
  initialPage,
}: {
  ownerId: string;
  initialProject: Project;
  initialPage: Awaited<ReturnType<typeof listEveConversations>>;
}) {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const project = useQuery(
    trpc.project.getById.queryOptions(
      { id: initialProject.id },
      { initialData: initialProject }
    )
  );
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  async function refresh() {
    await cache.invalidateQueries({ queryKey: trpc.project.pathKey() });
  }
  const save = useMutation(
    trpc.project.setInstructions.mutationOptions({
      onSuccess: async () => {
        await refresh();
        setInstructionsOpen(false);
      },
    })
  );
  const rename = useMutation(
    trpc.project.update.mutationOptions({ onSuccess: refresh })
  );
  const current = project.data;
  const icon =
    PROJECT_ICONS.find((value) => value === current.icon) ??
    DEFAULT_PROJECT_ICON;
  const color =
    PROJECT_COLORS.find((value) => value.name === current.iconColor)?.name ??
    DEFAULT_PROJECT_COLOR;
  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="p-2">
        <SidebarTrigger />
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {project.isError && (
            <div role="alert">
              <p>Could not refresh this project.</p>
              <Button onClick={() => project.refetch()} variant="outline">
                Retry project
              </Button>
            </div>
          )}
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
          <NewEveConversation
            key={`${ownerId}:${current.id}`}
            ownerId={ownerId}
            projectId={current.id}
          />
          <EveHistoryList initialPage={initialPage} projectId={current.id} />
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
                  name: value.name,
                  icon: value.icon,
                  iconColor: value.color,
                },
              });
            }}
            open={renameOpen}
          />
        </div>
      </div>
    </section>
  );
}
