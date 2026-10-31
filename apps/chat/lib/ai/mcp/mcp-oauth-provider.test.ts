import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { McpOAuthClientProvider } from "../../../chatjs/plugins/mcp/oauth/mcp-oauth-provider";
import type { McpOAuthSession } from "@/chatjs/plugins/mcp/db/mcp-schema";
import { auth } from "@ai-sdk/mcp";

const sdkIssuer = "http://127.0.0.1:3799";
const sdkMetadata = {
  authorization_endpoint: `${sdkIssuer}/authorize`,
  code_challenge_methods_supported: ["S256"],
  issuer: sdkIssuer,
  registration_endpoint: `${sdkIssuer}/register`,
  response_types_supported: ["code"],
  token_endpoint: `${sdkIssuer}/token`,
};
const sdkResource = {
  authorization_servers: [sdkIssuer],
  resource: `${sdkIssuer}/mcp`,
};

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
  setClientInfo: vi.fn(),
  setCodeVerifier: vi.fn(),
}));
vi.mock("../../../chatjs/plugins/mcp/oauth/mcp-fetch", () => ({
  mcpFetch: mocks.fetch,
}));

vi.mock("@/chatjs/plugins/mcp/db/mcp-queries", () => ({
  getAuthenticatedSession: mocks.read,
  getSessionByState: mocks.read,
  saveTokensAndCleanup: mocks.save,
  setOAuthClientInfoOnceByState: mocks.setClientInfo,
  setOAuthCodeVerifierOnceByState: mocks.setCodeVerifier,
}));
vi.mock("@/chatjs/plugins/mcp/db/mcp-oauth-lock", () => ({
  withMcpOAuthRefreshLock: async (
    _id: string,
    run: () => Promise<unknown>
  ): Promise<unknown> => await run(),
}));
let stored: McpOAuthSession;
const provider = (): McpOAuthClientProvider =>
  new McpOAuthClientProvider({
    clientMetadata: { redirect_uris: ["http://localhost:3790/callback"] },
    mcpConnectorId: "connector",
    onRedirectToAuthorization: vi.fn<() => Promise<void>>().mockResolvedValue(),
    serverUrl: "http://127.0.0.1:3799/mcp",
  });
const refreshRequest = (refreshToken: string): Request =>
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
  // oxlint-disable-next-line typescript/promise-function-async -- The async DB read fixture must observe stored after each credential write; a static resolved value becomes stale, and eslint/require-await rejects this immediate async reader.
  mocks.read.mockImplementation(() => Promise.resolve(stored));
  mocks.setClientInfo.mockImplementation(
    ({
      clientInfo,
    }: {
      readonly clientInfo: Readonly<Record<string, unknown>>;
    }) => {
      stored = { ...stored, clientInfo };
      return stored;
    }
  );
  mocks.setCodeVerifier.mockImplementation(
    ({ codeVerifier }: { readonly codeVerifier: string }) => {
      stored = { ...stored, codeVerifier };
      return stored;
    }
  );
  mocks.save.mockImplementation(
    ({ tokens }: { readonly tokens: Readonly<Record<string, unknown>> }) => {
      stored = { ...stored, tokens };
      return stored;
    }
  );
});
test("absent stored credentials return undefined", async () => {
  stored = { ...stored, clientInfo: null, tokens: null };
  const client = provider();
  await expect(client.clientInformation()).resolves.toBeUndefined();
  await expect(client.tokens()).resolves.toBeUndefined();
});
test("credentials saved by the pinned SDK can be read by a fresh provider", async () => {
  stored = { ...stored, tokens: null };
  mocks.fetch
    .mockResolvedValueOnce(Response.json(sdkResource))
    .mockResolvedValueOnce(Response.json(sdkMetadata))
    .mockResolvedValueOnce(
      Response.json({
        client_id: "sdk-client",
        client_secret: "sdk-secret",
        redirect_uris: ["http://localhost:3790/callback"],
        token_endpoint_auth_method: "client_secret_post",
      })
    );
  await expect(
    auth(provider(), { fetchFn: provider().fetch, serverUrl: stored.serverUrl })
  ).resolves.toBe("REDIRECT");
  const registered = stored.clientInfo;
  mocks.fetch
    .mockResolvedValueOnce(Response.json(sdkResource))
    .mockResolvedValueOnce(Response.json(sdkMetadata))
    .mockResolvedValueOnce(
      Response.json({
        access_token: "sdk-access",
        refresh_token: "sdk-refresh",
        token_type: "Bearer",
      })
    );
  await expect(
    auth(provider(), {
      authorizationCode: "code",
      callbackIssuer: sdkIssuer,
      fetchFn: provider().fetch,
      serverUrl: stored.serverUrl,
    })
  ).resolves.toBe("AUTHORIZED");
  await expect(provider().clientInformation()).resolves.toEqual(registered);
  await expect(provider().tokens()).resolves.toEqual(stored.tokens);
  expect(stored.tokens).toMatchObject({
    authorization_server: new URL(sdkIssuer).href,
    issuer: sdkIssuer,
    token_endpoint: sdkMetadata.token_endpoint,
  });
});
afterEach(() => vi.unstubAllGlobals());

test("stored client information retains metadata, credentials, pins and extensions", async () => {
  const clientInfo = {
    authorization_server: "https://auth.example.test",
    client_id: "registered",
    client_secret: "secret",
    issuer: "https://auth.example.test",
    redirect_uris: ["http://localhost:3790/callback"],
    registration_access_token: "registration-secret",
    token_endpoint: "https://auth.example.test/token",
    token_endpoint_auth_method: "client_secret_basic",
  };
  stored = { ...stored, clientInfo };
  await expect(provider().clientInformation()).resolves.toEqual(clientInfo);
});
test("older records without authorization-server pins remain readable", async () => {
  const clientInfo = {
    client_id: "legacy",
    redirect_uris: ["http://localhost:3790/callback"],
  };
  stored = { ...stored, clientInfo };
  const client = provider();
  await expect(client.clientInformation()).resolves.toEqual(clientInfo);
  await expect(client.tokens()).resolves.toEqual(stored.tokens);
});
test.each([
  {},
  { client_id: "registered" },
  { client_id: "registered", redirect_uris: "https://chat.example/callback" },
  { client_id: "registered", redirect_uris: ["data:secret"] },
  { client_id: "registered", client_secret: false, redirect_uris: [] },
])(
  "malformed stored client information fails without leaking or changing credentials: %j",
  async (clientInfo: Readonly<Record<string, unknown>>) => {
    stored = { ...stored, clientInfo };
    await expect(provider().clientInformation()).rejects.toThrow(
      "Invalid stored MCP OAuth client information; reconnect this connector."
    );
    expect(stored.clientInfo).toEqual(clientInfo);
    expect(mocks.setClientInfo).not.toHaveBeenCalled();
  }
);
test.each([
  {},
  { access_token: "secret" },
  { access_token: false, token_type: "Bearer" },
  { access_token: "secret", expires_in: "3600", token_type: "Bearer" },
  { access_token: "secret", refresh_token: false, token_type: "Bearer" },
  { access_token: "secret", issuer: "invalid-url", token_type: "Bearer" },
  {
    access_token: "secret",
    token_endpoint: "data:secret",
    token_type: "Bearer",
  },
])(
  "malformed stored tokens fail without leaking or overwriting credentials: %j",
  async (tokens: Readonly<Record<string, unknown>>) => {
    stored = { ...stored, tokens };
    await expect(provider().tokens()).rejects.toThrow(
      "Invalid stored MCP OAuth tokens; reconnect this connector."
    );
    expect(stored.tokens).toEqual(tokens);
    expect(mocks.save).not.toHaveBeenCalled();
  }
);
test("tokens read under the refresh lock are decoded before reuse", async () => {
  const client = provider();
  await client.tokens();
  stored = { ...stored, tokens: { refresh_token: "other-secret" } };
  await expect(client.fetch(refreshRequest("refresh-old"))).rejects.toThrow(
    "Invalid stored MCP OAuth tokens; reconnect this connector."
  );
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
test("a repaired stored credential can replace a stale malformed cache", async () => {
  stored = { ...stored, tokens: { access_token: false } };
  const client = provider();
  await client.adoptState("state");
  stored = {
    ...stored,
    tokens: {
      access_token: "repaired",
      refresh_token: "refresh-old",
      token_type: "Bearer",
    },
  };
  const response = await client.fetch(refreshRequest("refresh-old"));
  expect(await response.json()).toEqual(stored.tokens);
  await expect(client.tokens()).resolves.toEqual(stored.tokens);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
test("an empty redirect list remains supported for an authenticated SDK-shaped record", async () => {
  const clientInfo = { client_id: "registered", redirect_uris: [] };
  stored = { ...stored, clientInfo };
  await expect(provider().clientInformation()).resolves.toEqual(clientInfo);
});
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
  expect(stored.tokens).toHaveProperty("pin", "retained");
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
  expect(stored.tokens).toHaveProperty("access_token", "third");
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
test("configured OAuth client information preserves credentials", async () => {
  const client = new McpOAuthClientProvider({
    clientMetadata: {
      redirect_uris: ["https://chat.example.test/callback"],
      token_endpoint_auth_method: "client_secret_basic",
    },
    mcpConnectorId: "connector",
    oauthClientId: "configured-id",
    oauthClientSecret: "configured-secret",
    onRedirectToAuthorization: vi.fn<() => Promise<void>>().mockResolvedValue(),
    serverUrl: stored.serverUrl,
  });
  await expect(client.clientInformation()).resolves.toEqual({
    client_id: "configured-id",
    client_secret: "configured-secret",
    redirect_uris: ["https://chat.example.test/callback"],
    token_endpoint_auth_method: "client_secret_basic",
  });
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

test("a successful rotated refresh persists its credentials even after caller cancellation", async () => {
  const client = provider();
  await client.tokens();
  const controller = new AbortController();
  mocks.fetch.mockImplementationOnce(() => {
    controller.abort(new Error("refresh cancelled"));
    return Response.json({
      access_token: "new",
      refresh_token: "rotated",
      token_type: "Bearer",
    });
  });
  await client.fetch(
    new Request(refreshRequest("refresh-old"), { signal: controller.signal })
  );
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(stored.tokens).toMatchObject({
    access_token: "new",
    refresh_token: "rotated",
  });
});
