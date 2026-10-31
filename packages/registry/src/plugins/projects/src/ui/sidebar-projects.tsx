"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usePathname, useRouter } from "next/navigation";

import { FolderPlus } from "lucide-react";

import type { ProjectDetailsData } from "@/chatjs/plugins/projects/ui/project-details-dialog";

import { ProjectDetailsDialog } from "@/chatjs/plugins/projects/ui/project-details-dialog";

import type { JSX as ReactJSX } from "react";
import { SidebarProjectItem } from "@/chatjs/plugins/projects/ui/sidebar-project-item";

import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";
import { useTRPC } from "@/trpc/react";

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
  const membership = useQuery(
    trpc.project.forChat.queryOptions(
      { id: route.id ?? "" },
      { enabled: Boolean(route.id) }
    )
  );
  const currentProjectId =
    (route.pluginId === "projects" ? route.contextId : null) ??
    membership.data?.id;

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

  const handleCreateProject = async (
    data: ProjectDetailsData
  ): Promise<void> => {
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
          onClick={() => {
            setNewProjectDialogOpen(true);
          }}
        >
          <FolderPlus className="size-4" />
          <span>New project</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {!isLoading &&
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
