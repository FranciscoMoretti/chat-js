import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { creditsRouter } from "./router";

export default function credits() {
  return {
    id: "credits",
    routers: { credits: creditsRouter },
  } satisfies ChatPlugin;
}
