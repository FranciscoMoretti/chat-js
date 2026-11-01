"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
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
  slots: [
    slot(SidebarSections, ProjectsSidebar),
    slot(ChatActions, ProjectChatActions),
    slot(ChatBreadcrumbs, ProjectBreadcrumb),
  ],
});
