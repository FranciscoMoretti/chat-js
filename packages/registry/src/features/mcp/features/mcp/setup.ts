import descriptor from "@/features/mcp/chatjs.json";
import { readMcpEncryptionKey } from "./mcp-env";
import { requireCredentials } from "@/lib/required-credentials";

export const requireMcpCredentials = (): void => {
  requireCredentials("mcp", descriptor.envRequirements, process.env);
  readMcpEncryptionKey();
};
