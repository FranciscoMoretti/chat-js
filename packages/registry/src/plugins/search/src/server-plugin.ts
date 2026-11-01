import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { searchRouter } from "./router";

export const search = () =>
  ({ id: "search", routers: { search: searchRouter } }) satisfies ChatPlugin;
