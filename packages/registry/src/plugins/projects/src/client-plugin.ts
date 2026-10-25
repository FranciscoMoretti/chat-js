import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import {
  ProjectsSidebar,
  ProjectChatActions,
  ProjectBreadcrumb,
} from "./ui/chat-contributions";

export const projectsClient = () =>
  ({
    id: "projects",
    chat: {
      Sidebar: ProjectsSidebar,
      Actions: ProjectChatActions,
      Breadcrumb: ProjectBreadcrumb,
    },
  }) satisfies ChatClientPlugin;
