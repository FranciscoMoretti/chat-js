"use client";
import { definePlugin } from "@/lib/ui-slots";
import {
  SidebarSections,
  ChatActions,
  ChatBreadcrumbs,
} from "@/components/chat-slots";
import {
  ProjectsSidebar,
  ProjectChatActions,
  ProjectBreadcrumb,
} from "./ui/chat-contributions";

export const projectsClient = definePlugin({
  id: "projects",
  contributions: [
    SidebarSections.contribute(ProjectsSidebar),
    ChatActions.contribute(ProjectChatActions),
    ChatBreadcrumbs.contribute(ProjectBreadcrumb),
  ],
});
