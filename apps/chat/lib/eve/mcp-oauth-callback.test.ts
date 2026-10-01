import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

import { GET } from "@/app/api/mcp/oauth/callback/route";
import { MissingCredentialsError } from "@/lib/required-credentials";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireCredentials: vi.fn(),
}));
vi.mock("@/features/mcp/setup", () => ({
  requireMcpCredentials: mocks.requireCredentials,
}));
vi.mock("@/lib/ai/mcp/mcp-client-manager", () => ({
  createMcpClientForCallback: vi.fn(),
  removeMcpClient: vi.fn(),
}));
vi.mock("@/lib/db/mcp-queries", () => ({
  getMcpConnectorById: vi.fn(),
  getSessionByState: mocks.getSession,
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ error: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/nuqs/mcp-search-params.server", () => ({
  loadMcpOAuthCallbackSearchParams: () => ({
    code: "code",
    error: null,
    error_description: null,
    state: "state",
  }),
}));

it("redirects an OAuth callback with an explicit setup error before accessing connector secrets", async () => {
  mocks.requireCredentials.mockImplementation(() => {
    throw new MissingCredentialsError("mcp", [
      { options: [["MCP_ENCRYPTION_KEY"]] },
    ]);
  });
  const response = await GET(
    new NextRequest(
      "https://chat.example.test/api/mcp/oauth/callback?code=code&state=state"
    )
  );
  expect(response.status).toBe(307);
  const location = new URL(response.headers.get("location") ?? "");
  expect(location.pathname).toBe("/settings/connectors");
  expect(location.searchParams.get("error")).toBe(
    "Missing credentials for mcp: MCP_ENCRYPTION_KEY"
  );
  expect(mocks.getSession).not.toHaveBeenCalled();
});
