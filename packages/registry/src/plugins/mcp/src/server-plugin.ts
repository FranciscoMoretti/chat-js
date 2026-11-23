import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { mcpRouter } from "./router";

export default function mcp() {
  return { id: "mcp", routers: { mcp: mcpRouter } } satisfies ChatPlugin;
}
