import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { sharingRouter } from "./router";

export default function sharing() {
  return {
    id: "sharing",
    routers: { sharing: sharingRouter },
  } satisfies ChatPlugin;
}
