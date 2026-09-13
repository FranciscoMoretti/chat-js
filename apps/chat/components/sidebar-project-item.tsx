"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import { InternalLink } from "@/components/internal-link";
import {
  type ProjectDetailsData,
  ProjectDetailsDialog,
} from "@/components/project-details-dialog";
import { ProjectIcon } from "@/components/project-icon";
import { ProjectMenuItems } from "@/components/project-menu-items";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useRenameProject } from "@/hooks/chat-sync-hooks";
import type { Project } from "@/lib/db/schema";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";

export function SidebarProjectItem({
  project,
  isActive,
  setOpenMobile,
}: {
  project: Project;
  isActive: boolean;
  setOpenMobile: (open: boolean) => void;
}) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { mutateAsync: renameProject, isPending } = useRenameProject();

  const projectHref = `/project/${project.id}` as const;

  const handleRename = async (data: ProjectDetailsData) => {
    await renameProject({
      id: project.id,
      updates: {
        name: data.name,
        icon: data.icon,
        iconColor: data.color,
      },
    });
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className="cursor-pointer" isActive={isActive}>
        <InternalLink
          href={projectHref}
          onNavigate={() => {
            setOpenMobile(false);
          }}
          prefetch={false}
        >
          <ProjectIcon
            color={project.iconColor as ProjectColorName}
            icon={project.icon as ProjectIconName}
            size={16}
          />
          <span>{project.name}</span>
        </InternalLink>
      </SidebarMenuButton>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
            showOnHover={!isActive}
          >
            <MoreHorizontal size={16} />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom">
          <ProjectMenuItems
            onDelete={() => setShowDeleteDialog(true)}
            onRename={() => setShowEditDialog(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDetailsDialog
        initialColor={project.iconColor as ProjectColorName}
        initialIcon={project.icon as ProjectIconName}
        initialName={project.name}
        isLoading={isPending}
        mode="edit"
        onOpenChange={setShowEditDialog}
        onSubmit={handleRename}
        open={showEditDialog}
      />

      <DeleteProjectDialog
        deleteId={project.id}
        setShowDeleteDialog={setShowDeleteDialog}
        showDeleteDialog={showDeleteDialog}
      />
    </SidebarMenuItem>
  );
}
