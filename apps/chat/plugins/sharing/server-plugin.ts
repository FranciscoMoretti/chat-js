import type { ChatPlugin } from "@/lib/plugin-contracts";
import { sharingRouter } from "./router";

export const sharing = () =>
  ({ id: "sharing", routers: { sharing: sharingRouter } }) satisfies ChatPlugin;
