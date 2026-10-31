import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { creditsRouter } from "./router";

export const credits = () =>
  ({ id: "credits", routers: { credits: creditsRouter } }) satisfies ChatPlugin;
