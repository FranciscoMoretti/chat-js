import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

import { GET } from "@/app/api/mcp/oauth/callback/route";
import { MissingCredentialsError } from "@/lib/required-credentials";

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  getSession: vi.fn(),
  params: {
    code: "code" as string | null,
    error: null as string | null,
    error_description: null as string | null,
    state: "state",
  },
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
  deleteSessionByState: mocks.deleteSession,
  getMcpConnectorById: vi.fn(),
  getSessionByState: mocks.getSession,
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ error: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/nuqs/mcp-search-params.server", () => ({
  loadMcpOAuthCallbackSearchParams: () => mocks.params,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.params = {
    code: "code",
    error: null,
    error_description: null,
    state: "state",
  };
});

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

it("provider cancellation deletes only pending state and returns a safe connector-scoped message", async () => {
  mocks.params = {
    code: null,
    error: "access_denied",
    error_description: "secret provider detail",
    state: "state",
  };
  mocks.getSession.mockResolvedValue({
    mcpConnectorId: "connector",
    state: "state",
    tokens: null,
  });
  const response = await GET(
    new NextRequest(
      "https://chat.example.test/api/mcp/oauth/callback?error=access_denied&state=state"
    )
  );
  const location = new URL(response.headers.get("location") ?? "");
  expect(location.pathname).toBe("/settings/connectors/connector");
  expect(location.searchParams.get("error")).toBe(
    "Authorization was not completed. Please try connecting again."
  );
  expect(location.toString()).not.toContain("secret");
  expect(mocks.deleteSession).toHaveBeenCalledWith({ state: "state" });
});
