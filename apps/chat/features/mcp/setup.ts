import descriptor from "@/features/mcp/chatjs.json";
import { env } from "@/lib/env";
import { requireCredentials } from "@/lib/required-credentials";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (requireMcpCredentials); the enabled import/no-default-export convention rejects the default-export alternative. */
export const requireMcpCredentials = (): void => {
  requireCredentials("mcp", descriptor.envRequirements, {
    MCP_ENCRYPTION_KEY: env.MCP_ENCRYPTION_KEY,
    NODE_ENV: env.NODE_ENV,
  });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
