"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useState } from "react";

import { ProjectDetailsDialog } from "@/components/project-details-dialog";
import type { ProjectDetailsData } from "@/components/project-details-dialog";
import { SidebarProjectItem } from "@/components/sidebar-project-item";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";
import { useTRPC } from "@/trpc/react";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- SidebarProjects: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including identity.data?.projectId); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including data). */

export const SidebarProjects = () => {
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
  const currentProjectId = route.projectId ?? identity.data?.projectId;

  const createProjectMutation = useMutation(
    trpc.project.create.mutationOptions({
      onSuccess: (data) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.project.list.queryKey(),
        });
        setNewProjectDialogOpen(false);
        setOpenMobile(false);
        router.push(`/project/${data.id}`);
      },
    })
  );

  const handleCreateProject = async (data: ProjectDetailsData) => {
    await createProjectMutation.mutateAsync({
      icon: data.icon,
      iconColor: data.color,
      name: data.name,
    });
  };

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => setNewProjectDialogOpen(true)}
        >
          <FolderPlus className="size-4" />
          <span>New project</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {!isLoading &&
        projects?.map((project) => {
          const isActive = currentProjectId === project.id;
          return (
            <SidebarProjectItem
              isActive={isActive}
              key={project.id}
              project={project}
              setOpenMobile={setOpenMobile}
            />
          );
        })}

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
