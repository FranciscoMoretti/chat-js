import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { projectRouter } from "./router";

export const projects = () =>
  ({
    id: "projects",
    routers: { project: projectRouter },
  }) satisfies ChatPlugin;
