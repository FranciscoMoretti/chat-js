"use client";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderInput } from "lucide-react";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { InternalLink } from "@/components/internal-link";
import type { ChatActionProps } from "@/lib/chat-plugin-contracts";
import { SidebarProjects } from "./sidebar-projects";
import { EveMoveProjectDialog } from "./eve-move-project-dialog";
import { ProjectIcon } from "./project-icon";
import { getProjectColorName, getProjectIconName } from "../project-icons";

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
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <FolderInput size={16} />
        <span>Move to project</span>
      </DropdownMenuItem>
      {open && (
        <EveMoveProjectDialog
          conversation={chat}
          onClose={() => {
            setOpen(false);
          }}
        />
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
        <BreadcrumbLink asChild>
          <InternalLink
            aria-label={project.name}
            title={project.name}
            href={`/project/${project.id}`}
          >
            <ProjectIcon
              icon={getProjectIconName(project.icon)}
              color={getProjectColorName(project.iconColor)}
              size={16}
            />
          </InternalLink>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
    </>
  );
};
