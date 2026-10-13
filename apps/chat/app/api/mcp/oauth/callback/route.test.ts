import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

import { GET } from "@/app/api/mcp/oauth/callback/route";
import { MissingCredentialsError } from "@/lib/required-credentials";

const HTTP_STATUS = {
  temporaryRedirect: 307,
};

const mocks = vi.hoisted(() => {
  const params: {
    code: string | null;
    error: string | null;
    error_description: string | null;
    state: string;
  } = {
    code: "code",
    error: null,
    error_description: null,
    state: "state",
  };
  return {
    deleteSession: vi.fn(),
    getSession: vi.fn(),
    invalidate: vi.fn(),
    params,
    removeClient: vi.fn(),
    requireCredentials: vi.fn(),
  };
});
vi.mock("@/features/mcp/setup", () => ({
  requireMcpCredentials: mocks.requireCredentials,
}));
vi.mock("@/lib/ai/mcp/mcp-client-manager", () => ({
  createMcpClientForCallback: vi.fn(),
  removeMcpClient: mocks.removeClient,
}));
vi.mock("@/lib/ai/mcp/cache", () => ({
  invalidateAllMcpCaches: mocks.invalidate,
}));
vi.mock("@/lib/db/mcp-queries", () => ({
  deletePendingSessionByState: mocks.deleteSession,
  getMcpConnectorById: vi.fn(),
  getSessionByState: mocks.getSession,
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: (): {
    error: (...arguments_: readonly unknown[]) => unknown;
    info: (...arguments_: readonly unknown[]) => unknown;
  } => ({ error: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/nuqs/mcp-search-params.server", () => ({
  loadMcpOAuthCallbackSearchParams: (): typeof mocks.params => mocks.params,
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
  expect(response.status).toBe(HTTP_STATUS.temporaryRedirect);
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
  const pending = { mcpConnectorId: "connector", state: "state", tokens: null };
  mocks.getSession.mockResolvedValue(pending);
  mocks.deleteSession.mockResolvedValue(pending);
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
  expect(mocks.removeClient).toHaveBeenCalledWith("connector", "state");
  expect(mocks.invalidate).toHaveBeenCalledWith("connector");
});

it.each([
  undefined,
  {
    mcpConnectorId: "connector",
    state: "state",
    tokens: { access_token: "active" },
  },
])(
  "provider errors do not delete an authenticated or unmatched session: %j",
  async (
    session: Readonly<
      | {
          mcpConnectorId: string;
          state: string;
          readonly tokens: { readonly access_token: string };
        }
      | undefined
    >
  ) => {
    mocks.params = {
      code: null,
      error: "access_denied",
      error_description: null,
      state: "state",
    };
    mocks.getSession.mockResolvedValue(session);
    const response = await GET(
      new NextRequest(
        "https://chat.example.test/api/mcp/oauth/callback?error=access_denied&state=state"
      )
    );
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe(
      session ? "/settings/connectors/connector" : "/settings/connectors"
    );
    expect(mocks.deleteSession).not.toHaveBeenCalled();
    expect(mocks.removeClient).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  }
);

it("an attempt completed between lookup and deletion retains its client", async () => {
  mocks.params = {
    code: null,
    error: "access_denied",
    error_description: null,
    state: "state",
  };
  mocks.getSession.mockResolvedValue({
    mcpConnectorId: "connector",
    state: "state",
    tokens: null,
  });
  mocks.deleteSession.mockResolvedValue(null);
  await GET(
    new NextRequest(
      "https://chat.example.test/api/mcp/oauth/callback?error=access_denied&state=state"
    )
  );
  expect(mocks.removeClient).not.toHaveBeenCalled();
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
