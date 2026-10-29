"use client";
import { BreadcrumbNavigationLink } from "@/components/navigation-links";
import React, { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderInput } from "lucide-react";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { MoveMenuItem } from "./move-menu-item";
import {
  BreadcrumbItem,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import type { ChatActionProps } from "@/lib/chat-plugin-contracts";
import { SidebarProjects } from "./sidebar-projects";

import { ProjectIcon } from "./project-icon";
import { getProjectColorName, getProjectIconName } from "../project-icons";

const EveMoveProjectDialog = lazy(async () => {
  const dialog = await import("./eve-move-project-dialog");
  return { default: dialog.EveMoveProjectDialog };
});

export const ProjectsSidebar = (): React.JSX.Element | null => {
  const { data: session } = useSession();
  return session?.user ? (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarProjects />
      </SidebarMenu>
    </SidebarGroup>
  ) : null;
};

export const ProjectChatActions = ({
  chat,
}: ChatActionProps): React.JSX.Element | null => {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  if (!session?.user || (chat.state !== undefined && chat.state !== "bound")) {
    return null;
  }
  return (
    <>
      <MoveMenuItem
        onActivate={() => {
          setOpen(true);
        }}
      >
        <FolderInput size={16} />
        <span>Move to project</span>
      </MoveMenuItem>
      {open && (
        <Suspense fallback={null}>
          <EveMoveProjectDialog
            conversation={chat}
            onClose={() => {
              setOpen(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
};

export const ProjectBreadcrumb = ({
  chatId,
}: {
  readonly chatId: string;
}): React.JSX.Element | null => {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const { data: project } = useQuery(
    trpc.project.forChat.queryOptions(
      { id: chatId },
      { enabled: Boolean(session?.user) }
    )
  );
  if (!project || !session?.user) {
    return null;
  }
  return (
    <>
      <BreadcrumbItem>
        <BreadcrumbNavigationLink
          aria-label={project.name}
          title={project.name}
          href={`/project/${project.id}`}
        >
          <ProjectIcon
            icon={getProjectIconName(project.icon)}
            color={getProjectColorName(project.iconColor)}
            size={16}
          />
        </BreadcrumbNavigationLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
    </>
  );
};
