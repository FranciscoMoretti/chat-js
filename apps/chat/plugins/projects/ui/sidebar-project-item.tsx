"use client";

import { SidebarLink } from "@/components/navigation-links";
import { SidebarActionMenu } from "@/components/sidebar-menus";
import { useState } from "react";
import { DeleteProjectDialog } from "@/plugins/projects/ui/delete-project-dialog";

import { MoreHorizontal } from "lucide-react";
import type { ProjectDetailsData } from "@/plugins/projects/ui/project-details-dialog";
import { ProjectDetailsDialog } from "@/plugins/projects/ui/project-details-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import {
  getProjectColorName,
  getProjectIconName,
} from "@/plugins/projects/project-icons";
import type { Project } from "@/plugins/projects/db/project-schema";
import { ProjectIcon } from "@/plugins/projects/ui/project-icon";
import { ProjectMenuItems } from "@/plugins/projects/ui/project-menu-items";

import type { JSX as ReactJSX } from "react";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { useRenameProject } from "@/plugins/projects/use-projects";

export const SidebarProjectItem = ({
  project,
  isActive,
  setOpenMobile,
}: {
  readonly project: ReadonlyNativeSurface<Project>;
  readonly isActive: boolean;
  readonly setOpenMobile: (open: boolean) => void;
}): ReactJSX.Element => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { mutateAsync: renameProject, isPending } = useRenameProject();

  const icon = getProjectIconName(project.icon);
  const color = getProjectColorName(project.iconColor);

  const projectHref = `/project/${project.id}` as const;

  const handleRename = async (data: ProjectDetailsData): Promise<void> => {
    await renameProject({
      id: project.id,
      updates: {
        icon: data.icon,
        iconColor: data.color,
        name: data.name,
      },
    });
  };
  return (
    <SidebarMenuItem>
      <SidebarLink
        className="cursor-pointer"
        isActive={isActive}
        href={projectHref}
        onNavigate={() => {
          setOpenMobile(false);
        }}
        prefetch={false}
      >
        <ProjectIcon color={color} icon={icon} size={16} />
        <span>{project.name}</span>
      </SidebarLink>

      <DropdownMenu modal>
        <SidebarActionMenu showOnHover={!isActive}>
          <MoreHorizontal size={16} />
          <span className="sr-only">More</span>
        </SidebarActionMenu>
        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuGroup>
            <ProjectMenuItems
              onDelete={() => {
                setShowDeleteDialog(true);
              }}
              onRename={() => {
                setShowEditDialog(true);
              }}
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDetailsDialog
        initialColor={color}
        initialIcon={icon}
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
};
