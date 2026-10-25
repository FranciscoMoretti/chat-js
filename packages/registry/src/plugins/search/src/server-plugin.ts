import type { ChatPlugin } from "@/lib/plugin-contracts";
import { searchRouter } from "./router";

export const search = () =>
  ({ id: "search", routers: { search: searchRouter } }) satisfies ChatPlugin;
