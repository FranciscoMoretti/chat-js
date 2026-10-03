import descriptor from "@/features/mcp/chatjs.json";
import { env } from "@/lib/env";
import { requireCredentials } from "@/lib/required-credentials";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const requireMcpCredentials = (): void => {
  requireCredentials("mcp", descriptor.envRequirements, {
    MCP_ENCRYPTION_KEY: env.MCP_ENCRYPTION_KEY,
    NODE_ENV: env.NODE_ENV,
  });
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
