import { afterEach, expect, it, vi } from "vitest";

import { requireMcpCredentials } from "@/features/mcp/setup";
import { MissingCredentialsError } from "@/lib/required-credentials";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("installed MCP reports a setup error without exposing secrets", () => {
  vi.stubEnv("MCP_ENCRYPTION_KEY", "");
  expect(requireMcpCredentials).toThrow(MissingCredentialsError);
  expect(requireMcpCredentials).toThrow(
    "Missing credentials for mcp: MCP_ENCRYPTION_KEY"
  );
  vi.stubEnv("MCP_ENCRYPTION_KEY", "configured-secret");
  expect(requireMcpCredentials).toThrow("must encode a 32-byte key");
  vi.stubEnv("MCP_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
  expect(requireMcpCredentials).not.toThrow();
});
