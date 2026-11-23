import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { projectRouter } from "./router";

export default function projects() {
  return {
    id: "projects",
    routers: { project: projectRouter },
  } satisfies ChatPlugin;
}
