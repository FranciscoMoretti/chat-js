import type { ChatPlugin } from "@/lib/plugin-contracts";
import { projectRouter } from "./router";

export const projects = () =>
  ({
    id: "projects",
    routers: { project: projectRouter },
  }) satisfies ChatPlugin;
