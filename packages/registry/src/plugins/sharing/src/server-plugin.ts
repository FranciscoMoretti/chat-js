import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { sharingRouter } from "./router";

export const sharing = () =>
  ({ id: "sharing", routers: { sharing: sharingRouter } }) satisfies ChatPlugin;
