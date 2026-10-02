import descriptor from "@/features/mcp/chatjs.json";
import { env } from "@/lib/env";
import { requireCredentials } from "@/lib/required-credentials";

export const requireMcpCredentials = () => {
  requireCredentials("mcp", descriptor.envRequirements, {
    MCP_ENCRYPTION_KEY: env.MCP_ENCRYPTION_KEY,
    NODE_ENV: env.NODE_ENV,
  });
};
