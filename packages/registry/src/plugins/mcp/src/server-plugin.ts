import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { mcpRouter } from "./router";

export const mcp = () =>
  ({ id: "mcp", routers: { mcp: mcpRouter } }) satisfies ChatPlugin;
