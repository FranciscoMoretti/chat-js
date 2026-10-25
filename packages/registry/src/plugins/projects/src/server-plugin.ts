import type { ChatPlugin } from "@/lib/plugin-contracts";
import { projectRouter } from "./router";
import { projectsChat } from "./chat";

export const projects = () =>
  ({
    id: "projects",
    routers: { project: projectRouter },
    chat: projectsChat,
  }) satisfies ChatPlugin;
