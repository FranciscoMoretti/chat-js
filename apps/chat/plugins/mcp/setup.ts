import descriptor from "@/plugins/mcp/chatjs.json";
import { validateEnvironment } from "./mcp-env";
import {
  MissingCredentialsError,
  requireCredentials,
} from "@/lib/required-credentials";

export const requireMcpCredentials = (): void => {
  requireCredentials("mcp", descriptor.envRequirements, process.env);
  if (validateEnvironment(process.env).length > 0) {
    throw new MissingCredentialsError("mcp", [
      {
        options: [["MCP_ENCRYPTION_KEY"]],
        description: "A base64-encoded 32-byte key is required",
      },
    ]);
  }
};
