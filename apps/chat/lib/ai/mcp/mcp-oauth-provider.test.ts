/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
import { auth } from "@ai-sdk/mcp";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { McpOAuthSession } from "../../db/schema";
import { McpOAuthClientProvider } from "./mcp-oauth-provider";
/* oxlint-enable import/no-relative-parent-imports */

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
vi.mock("./mcp-fetch", () => ({ mcpFetch: mocks.fetch }));

vi.mock("@/lib/db/mcp-queries", () => ({
  getAuthenticatedSession: mocks.read,
  getSessionByState: mocks.read,
  saveTokensAndCleanup: mocks.save,
  setOAuthClientInfoOnceByState: mocks.setClientInfo,
  setOAuthCodeVerifierOnceByState: mocks.setCodeVerifier,
}));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/db/mcp-oauth-lock")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/db/mcp-oauth-lock", () => ({
  withMcpOAuthRefreshLock: async (_id: string, run: () => Promise<unknown>) =>
    await run(),
}));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable init-declarations --
 * init-declarations (#507): stored assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let stored: McpOAuthSession;
/* oxlint-enable init-declarations */
/* oxlint-disable typescript/explicit-function-return-type, typescript/promise-function-async --
 * typescript/explicit-function-return-type (#560): Keep provider's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): provider preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const provider = () =>
  new McpOAuthClientProvider({
    clientMetadata: { redirect_uris: ["http://localhost:3790/callback"] },
    mcpConnectorId: "connector",
    onRedirectToAuthorization: (): Promise<void> => Promise.resolve(),
    serverUrl: "http://127.0.0.1:3799/mcp",
  });
/* oxlint-enable typescript/explicit-function-return-type, typescript/promise-function-async */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep refreshRequest's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const refreshRequest = (refreshToken: string) =>
  new Request("http://127.0.0.1:3799/token", {
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    method: "POST",
  });
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null --
 * no-magic-numbers (#517): beforeEach uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): beforeEach accepts { tokens }: { tokens: Record<string, unknown> }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): beforeEach preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): beforeEach preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
  mocks.setClientInfo.mockImplementation(
    ({ clientInfo }: { clientInfo: Record<string, unknown> }) => {
      stored = { ...stored, clientInfo };
      return stored;
    }
  );
  mocks.setCodeVerifier.mockImplementation(
    ({ codeVerifier }: { codeVerifier: string }) => {
      stored = { ...stored, codeVerifier };
      return stored;
    }
  );
  mocks.save.mockImplementation(
    ({ tokens }: { tokens: Record<string, unknown> }) => {
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

/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null */
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

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("multiple completed refreshes cannot overwrite a later rotation in delayed SDK s keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("multiple completed refreshes cannot overwrite a later rotation in delayed SDK s uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("refresh responses cannot replace the saved authorization-server pins") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("refresh responses cannot replace the saved authorization-server pins") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable max-statements, no-magic-numbers */

test("callback states cannot be adopted after a connector changes server URL", async () => {
  stored = { ...stored, serverUrl: "https://other.example.test/mcp" };
  await expect(provider().adoptState("state")).rejects.toThrow(
    "different MCP server"
  );
});

/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): test("configured OAuth client information preserves credentials") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("configured OAuth client information preserves credentials", async () => {
  const client = new McpOAuthClientProvider({
    clientMetadata: {
      redirect_uris: ["https://chat.example.test/callback"],
      token_endpoint_auth_method: "client_secret_basic",
    },
    mcpConnectorId: "connector",
    oauthClientId: "configured-id",
    oauthClientSecret: "configured-secret",
    onRedirectToAuthorization: (): Promise<void> => Promise.resolve(),
    serverUrl: stored.serverUrl,
  });
  await expect(client.clientInformation()).resolves.toEqual({
    client_id: "configured-id",
    client_secret: "configured-secret",
    redirect_uris: ["https://chat.example.test/callback"],
    token_endpoint_auth_method: "client_secret_basic",
  });
});
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("failed client registration persistence can be retried without an optimistic cac uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable no-magic-numbers */

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

/* oxlint-disable max-lines -- Keep the persisted OAuth credential contract, SDK round-trip and refresh-race cases together with their shared session fixture. */
