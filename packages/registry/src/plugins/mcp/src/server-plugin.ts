import type { ChatPlugin } from "@/lib/plugin-contracts";
import { mcpRouter } from "./router";

export const mcp = () =>
  ({ id: "mcp", routers: { mcp: mcpRouter } }) satisfies ChatPlugin;
