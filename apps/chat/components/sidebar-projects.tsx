"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

  // Auto-expand project if we're on a project route
  const currentProjectId = useMemo(
    () => parseChatIdFromPathname(pathname).projectId,
    [pathname]
  );

  const createProjectMutation = useMutation(
    trpc.project.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.project.list.queryKey(),
        });
        setNewProjectDialogOpen(false);
        setOpenMobile(false);
        router.push(`/project/${data.id}`);
      },
    })
  );

  const handleCreateProject = (data: ProjectDetailsData) => {
    createProjectMutation.mutate({
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
