import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { McpOAuthSession } from "../../db/schema";
import { McpOAuthClientProvider } from "./mcp-oauth-provider";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
  setClientInfo: vi.fn(),
}));
vi.mock("./mcp-fetch", () => ({ mcpFetch: mocks.fetch }));

vi.mock("@/lib/db/mcp-queries", () => ({
  getAuthenticatedSession: mocks.read,
  getSessionByState: mocks.read,
  saveTokensAndCleanup: mocks.save,
  setOAuthClientInfoOnceByState: mocks.setClientInfo,
}));
vi.mock("@/lib/db/mcp-oauth-lock", () => ({
  withMcpOAuthRefreshLock: async (_id: string, run: () => Promise<unknown>) =>
    await run(),
}));
let stored: McpOAuthSession;
const provider = () =>
  new McpOAuthClientProvider({
    clientMetadata: { redirect_uris: ["http://localhost:3790/callback"] },
    mcpConnectorId: "connector",
    onRedirectToAuthorization: () => Promise.resolve(),
    serverUrl: "http://127.0.0.1:3799/mcp",
  });
const refreshRequest = (refreshToken: string) =>
  new Request("http://127.0.0.1:3799/token", {
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    method: "POST",
  });
beforeEach(() => {
  vi.resetAllMocks();
  stored = {
    clientInfo: null,
    codeVerifier: null,
    createdAt: new Date(0),
    id: "session",
    mcpConnectorId: "connector",
    serverUrl: "http://127.0.0.1:3799/mcp",
    state: "state",
    tokens: {
      access_token: "old",
      pin: "retained",
      refresh_token: "refresh-old",
      token_type: "Bearer",
    },
    updatedAt: new Date(0),
  };
  mocks.read.mockImplementation(() => Promise.resolve(stored));
  mocks.save.mockImplementation(
    ({ tokens }: { tokens: Record<string, unknown> }) => {
      stored = { ...stored, tokens };
      return stored;
    }
  );
});
afterEach(() => vi.unstubAllGlobals());

test("an access-token winner is reused even when its refresh token did not change", async () => {
  const client = provider();
  await client.tokens();
  stored = { ...stored, tokens: { ...stored.tokens, access_token: "winner" } };
  const response = await client.fetch(refreshRequest("refresh-old"));
  expect(await response.json()).toMatchObject({ access_token: "winner" });
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});

test("multiple completed refreshes cannot overwrite a later rotation in delayed SDK saves", async () => {
  const client = provider();
  await client.tokens();
  const first = {
    access_token: "first",
    refresh_token: "refresh-first",
    token_type: "Bearer",
  };
  const second = {
    access_token: "second",
    refresh_token: "refresh-second",
    token_type: "Bearer",
  };
  mocks.fetch
    .mockResolvedValueOnce(Response.json(first))
    .mockResolvedValueOnce(Response.json(second));
  await client.fetch(refreshRequest("refresh-old"));
  await client.fetch(refreshRequest("refresh-first"));
  expect(stored.tokens?.pin).toBe("retained");
  stored = {
    ...stored,
    tokens: {
      access_token: "third",
      refresh_token: "refresh-third",
      token_type: "Bearer",
    },
  };
  await client.saveTokens(first);
  await client.saveTokens(second);
  expect(stored.tokens?.access_token).toBe("third");
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(await client.tokens()).toMatchObject({ access_token: "third" });
});

test("refresh responses cannot replace the saved authorization-server pins", async () => {
  const pins = {
    authorization_server: "https://trusted.example",
    issuer: "https://trusted.example",
    token_endpoint: "https://trusted.example/token",
  };
  stored = { ...stored, tokens: { ...stored.tokens, ...pins } };
  const client = provider();
  await client.tokens();
  mocks.fetch.mockResolvedValueOnce(
    Response.json({
      access_token: "new",
      authorization_server: "invalid-url",
      id_token: "identity",
      issuer: "https://untrusted.example",
      token_endpoint: "https://untrusted.example/token",
      token_type: "Bearer",
    })
  );
  const response = await client.fetch(refreshRequest("refresh-old"));
  expect(stored.tokens).toMatchObject({
    ...pins,
    access_token: "new",
    id_token: "identity",
    refresh_token: "refresh-old",
  });
  expect(await response.json()).toEqual({
    access_token: "new",
    id_token: "identity",
    token_type: "Bearer",
  });
  await client.saveTokens({ access_token: "new", token_type: "Bearer" });
  expect(stored.tokens).toMatchObject(pins);
  expect(mocks.save).toHaveBeenCalledTimes(1);
});

test("callback states cannot be adopted after a connector changes server URL", async () => {
  stored = { ...stored, serverUrl: "https://other.example.test/mcp" };
  await expect(provider().adoptState("state")).rejects.toThrow(
    "different MCP server"
  );
});

test("configured OAuth client credentials skip dynamic registration", async () => {
  const client = new McpOAuthClientProvider({
    clientMetadata: {
      redirect_uris: ["https://chat.example.test/callback"],
      token_endpoint_auth_method: "client_secret_basic",
    },
    mcpConnectorId: "connector",
    oauthClientId: "configured-id",
    oauthClientSecret: "configured-secret",
    onRedirectToAuthorization: () => Promise.resolve(),
    serverUrl: stored.serverUrl,
  });
  await expect(client.clientInformation()).resolves.toEqual({
    client_id: "configured-id",
    client_secret: "configured-secret",
    redirect_uris: ["https://chat.example.test/callback"],
    token_endpoint_auth_method: "client_secret_basic",
  });
  expect(mocks.fetch).not.toHaveBeenCalled();
});

test("failed client registration persistence can be retried without an optimistic cache", async () => {
  const client = provider();
  await client.tokens();
  const clientInfo = {
    client_id: "registered",
    redirect_uris: ["http://localhost:3790/callback"],
  };
  mocks.setClientInfo.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(client.saveClientInformation(clientInfo)).rejects.toThrow(
    "database unavailable"
  );
  mocks.setClientInfo.mockResolvedValueOnce({ ...stored, clientInfo });
  await client.saveClientInformation(clientInfo);
  expect(mocks.setClientInfo).toHaveBeenCalledTimes(2);
});

test("a cancelled refresh cannot begin token persistence after its response arrives", async () => {
  const client = provider();
  await client.tokens();
  const controller = new AbortController();
  mocks.fetch.mockImplementationOnce(() => {
    controller.abort(new Error("refresh cancelled"));
    return Response.json({ access_token: "new", token_type: "Bearer" });
  });
  await expect(
    client.fetch(
      new Request(refreshRequest("refresh-old"), { signal: controller.signal })
    )
  ).rejects.toThrow("refresh cancelled");
  expect(mocks.save).not.toHaveBeenCalled();
});
