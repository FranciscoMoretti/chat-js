"use client";

import React, { useState } from "react";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";

import { InternalLink } from "@/components/internal-link";

import { MoreHorizontal } from "lucide-react";
import type { ProjectDetailsData } from "@/components/project-details-dialog";
import { ProjectDetailsDialog } from "@/components/project-details-dialog";
/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/project-details-dialog and @/components/ui/dropdown-menu; keep this adjacent import pair ordered. */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getProjectColorName, getProjectIconName } from "@/lib/project-icons";
import type { Project } from "@/lib/db/schema";
import { ProjectIcon } from "@/components/project-icon";
/* oxlint-disable import/max-dependencies -- @/components/project-menu-items import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { ProjectMenuItems } from "@/components/project-menu-items";
/* oxlint-enable import/max-dependencies */

import type { JSX as ReactJSX } from "react";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { useRenameProject } from "@/hooks/use-projects";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SidebarProjectItem); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- SidebarProjectItem renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- SidebarProjectItem: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleRename's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        // oxlint-disable-next-line react/forbid-component-props -- SidebarMenuButton accepts className in its styling contract; preserve this caller's layout and appearance.
        className="cursor-pointer"
        isActive={isActive}
      >
        <InternalLink
          href={projectHref}
          onNavigate={() => {
            setOpenMobile(false);
          }}
          prefetch={false}
        >
          <ProjectIcon color={color} icon={icon} size={16} />
          <span>{project.name}</span>
        </InternalLink>
      </SidebarMenuButton>

      <DropdownMenu modal>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            // oxlint-disable-next-line react/forbid-component-props -- SidebarMenuAction accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */
