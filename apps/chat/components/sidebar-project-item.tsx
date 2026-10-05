"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX as ReactJSX } from "react";
import React, { useState } from "react";

import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import { InternalLink } from "@/components/internal-link";
import { ProjectDetailsDialog } from "@/components/project-details-dialog";
import type { ProjectDetailsData } from "@/components/project-details-dialog";
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
import { useRenameProject } from "@/hooks/use-projects";
/* oxlint-disable import/max-dependencies -- @/lib/db/schema import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import type { Project } from "@/lib/db/schema";
/* oxlint-enable import/max-dependencies */
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- SidebarProjectItem: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including data: ProjectDetailsData). */

export const SidebarProjectItem = ({
  project,
  isActive,
  setOpenMobile,
}: {
  project: Project;
  isActive: boolean;
  setOpenMobile: (open: boolean) => void;
}): ReactJSX.Element => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { mutateAsync: renameProject, isPending } = useRenameProject();

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
      <SidebarMenuButton asChild className="cursor-pointer" isActive={isActive}>
        <InternalLink
          href={projectHref}
          onNavigate={() => {
            setOpenMobile(false);
          }}
          prefetch={false}
        >
          <ProjectIcon
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Persisted project icon/color strings follow the project editor schema; introducing branded database values requires a storage contract migration.
            color={project.iconColor as ProjectColorName}

            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Persisted project icon/color strings follow the project editor schema; introducing branded database values requires a storage contract migration.
            icon={project.icon as ProjectIconName}
            size={16}
          />
          <span>{project.name}</span>
        </InternalLink>
      </SidebarMenuButton>

      <DropdownMenu modal>
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
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Persisted project icon/color strings follow the project editor schema; introducing branded database values requires a storage contract migration.
        initialColor={project.iconColor as ProjectColorName}

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Persisted project icon/color strings follow the project editor schema; introducing branded database values requires a storage contract migration.
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
};
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
