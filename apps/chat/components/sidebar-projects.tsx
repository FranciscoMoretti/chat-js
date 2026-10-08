"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { usePathname, useRouter } from "next/navigation";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useState } from "react";

import type { ProjectDetailsData } from "@/components/project-details-dialog";
/* oxlint-enable sort-imports */
import { ProjectDetailsDialog } from "@/components/project-details-dialog";
import { SidebarProjectItem } from "@/components/sidebar-project-item";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */
import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";
import { useTRPC } from "@/trpc/react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SidebarProjects); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- SidebarProjects renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, max-statements, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- SidebarProjects: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships */

export const SidebarProjects = (): ReactJSX.Element => {
  const pathname = usePathname();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setOpenMobile } = useSidebar();
  const { data: projects, isLoading } = useQuery(
    trpc.project.list.queryOptions()
  );
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);

  const route = parseChatIdFromPathname(pathname);
  const identity = useQuery(
    trpc.eve.get.queryOptions(
      { id: route.id ?? "" },
      { enabled: route.type === "chat" || route.type === "projectChat" }
    )
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading projectId from identity.data; preserve one receiver evaluation, skipped accesses and the existing identity.data?.projectId fallback. The app guidance prefers optional chaining.
  const currentProjectId = route.projectId ?? identity.data?.projectId;

  const createProjectMutation = useMutation(
    trpc.project.create.mutationOptions({
      onSuccess: (data: Readonly<{ id: string }>) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.project.list.queryKey(),
        });
        setNewProjectDialogOpen(false);
        setOpenMobile(false);
        router.push(`/project/${data.id}`);
      },
    })
  );

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleCreateProject's awaited sequencing and rejected-Promise behavior. */
  const handleCreateProject = async (
    data: ProjectDetailsData
  ): Promise<void> => {
    await createProjectMutation.mutateAsync({
      icon: data.icon,
      iconColor: data.color,
      name: data.name,
    });
  };
  /* oxlint-enable oxc/no-async-await */
  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          // oxlint-disable-next-line react/forbid-component-props -- SidebarMenuButton accepts className in its styling contract; preserve this caller's layout and appearance.
          className="cursor-pointer"
          onClick={() => setNewProjectDialogOpen(true)}
        >
          <FolderPlus
            // oxlint-disable-next-line react/forbid-component-props -- FolderPlus accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-4"
          />
          <span>New project</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {!isLoading &&
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading map from projects; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        projects?.map(
          (
            project: ReadonlyNativeSurface<NonNullable<typeof projects>[number]>
          ) => {
            const isActive = currentProjectId === project.id;
            return (
              <SidebarProjectItem
                isActive={isActive}
                key={project.id}
                project={project}
                setOpenMobile={setOpenMobile}
              />
            );
          }
        )}

      <ProjectDetailsDialog
        isLoading={createProjectMutation.isPending}
        mode="create"
        onOpenChange={setNewProjectDialogOpen}
        onSubmit={handleCreateProject}
        open={newProjectDialogOpen}
      />
    </>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */
