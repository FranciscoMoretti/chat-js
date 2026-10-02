import { beforeEach, expect, it, vi } from "vitest";

import { MCPClient } from "./mcp-client";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  create: vi.fn(),
  provider: vi.fn(),
  tools: vi.fn(),
}));
vi.mock("@ai-sdk/mcp", () => ({
  auth: vi.fn(),
  experimental_createMCPClient: mocks.create,
}));
vi.mock("@/lib/config", () => ({ config: { appPrefix: "chatjs" } }));
vi.mock("@/lib/url", () => ({ getBaseUrl: () => "http://localhost:3790" }));
vi.mock("./mcp-oauth-provider", () => ({
  McpOAuthClientProvider: mocks.provider,
}));
vi.mock("./cache", () => {
  throw new Error("Runtime client must not load Next.js cache APIs");
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.close.mockResolvedValue(undefined);
  mocks.tools.mockResolvedValue({});
  mocks.create.mockResolvedValue({ close: mocks.close, tools: mocks.tools });
});

it("connects, discovers and closes without web cache dependencies", async () => {
  const client = new MCPClient("id", "Test", {
    headers: { Authorization: "test" },
    type: "http",
    url: "https://mcp.test",
  });
  await client.connect();
  expect(client.status).toBe("connected");
  expect(await client.tools()).toEqual({});
  await client.close();
  expect(client.status).toBe("disconnected");
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      transport: expect.objectContaining({
        headers: { Authorization: "test" },
        type: "http",
      }),
    })
  );
});

it("notifies the web owner after disconnect and authentication errors", async () => {
  const invalidate = vi.fn();
  const client = new MCPClient(
    "id",
    "Test",
    { type: "sse", url: "https://mcp.test" },
    invalidate
  );
  await client.connect();
  mocks.tools.mockRejectedValueOnce(new Error("401 Unauthorized"));
  await expect(client.tools()).rejects.toThrow("401 Unauthorized");
  expect(invalidate).toHaveBeenCalledOnce();
  await client.close();
  expect(invalidate).toHaveBeenCalledTimes(2);
});

it("concurrent connection requests share one transport and close it once", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.create.mockImplementationOnce(async () => {
    await gate.promise;
    return { close: mocks.close, tools: mocks.tools };
  });
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  const first = client.connect();
  const second = client.connect();
  expect(mocks.create).toHaveBeenCalledOnce();
  gate.resolve(undefined);
  await Promise.all([first, second]);
  await client.close();
  expect(mocks.close).toHaveBeenCalledOnce();
});

it("a failed connection can be retried without retaining a failed promise", async () => {
  mocks.create.mockRejectedValueOnce(new Error("temporarily unavailable"));
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  await expect(client.connect()).rejects.toThrow("temporarily unavailable");
  await client.connect();
  expect(client.status).toBe("connected");
  expect(mocks.create).toHaveBeenCalledTimes(2);
  await client.close();
});

it("domain errors mentioning tokens do not invalidate authentication", async () => {
  const invalidate = vi.fn();
  const client = new MCPClient(
    "id",
    "Test",
    { type: "http", url: "https://mcp.test" },
    invalidate
  );
  await client.connect();
  mocks.tools.mockRejectedValueOnce(new Error("Document exceeds token budget"));
  await expect(client.tools()).rejects.toThrow("token budget");
  expect(invalidate).not.toHaveBeenCalled();
  await client.close();
});

it("OAuth secrets go to the provider and never the resource transport", async () => {
  const client = new MCPClient("id", "Configured", {
    oauthClientId: "configured-id",
    oauthClientSecret: "configured-secret",
    type: "http",
    url: "https://resource.example.test/mcp",
  });
  await client.connect();
  expect(mocks.provider).toHaveBeenCalledWith(
    expect.objectContaining({
      clientMetadata: expect.objectContaining({
        token_endpoint_auth_method: "client_secret_basic",
      }),
      oauthClientId: "configured-id",
      oauthClientSecret: "configured-secret",
    })
  );
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      transport: expect.objectContaining({ headers: undefined }),
    })
  );
  await client.close();
});

it("closing an in-flight connection prevents the late transport from becoming active", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.create.mockImplementationOnce(async () => {
    await gate.promise;
    return { close: mocks.close, tools: mocks.tools };
  });
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  const connecting = client.connect();
  const rejected = expect(connecting).rejects.toThrow("closed");
  await client.close();
  gate.resolve(undefined);
  await rejected;
  expect(client.status).toBe("disconnected");
  expect(mocks.close).toHaveBeenCalledOnce();
});

it("connection initialization always receives a cancellation signal", async () => {
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  await client.connect();
  const signal = mocks.create.mock.calls[0]?.[0].initializationOptions.signal;
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal.aborted).toBe(false);
  await client.close();
  expect(signal.aborted).toBe(true);
});

it("callers cancel their shared connection waits independently", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.create.mockImplementationOnce(async () => {
    await gate.promise;
    return { close: mocks.close, tools: mocks.tools };
  });
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  const firstAbort = new AbortController();
  const secondAbort = new AbortController();
  const first = client.connect(undefined, firstAbort.signal);
  const second = client.connect(undefined, secondAbort.signal);
  firstAbort.abort(new Error("first cancelled"));
  await expect(first).rejects.toThrow("first cancelled");
  expect(
    mocks.create.mock.calls[0][0].initializationOptions.signal.aborted
  ).toBe(false);
  gate.resolve(undefined);
  await second;
  expect(client.status).toBe("connected");
  expect(mocks.create).toHaveBeenCalledOnce();
  await client.close();
});

it("a fresh connection starts immediately after closing a pending attempt", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.create.mockImplementationOnce(async () => {
    await gate.promise;
    return { close: mocks.close, tools: mocks.tools };
  });
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  const first = client.connect();
  const rejected = expect(first).rejects.toThrow("closed");
  await client.close();
  await client.connect();
  expect(client.status).toBe("connected");
  expect(mocks.create).toHaveBeenCalledTimes(2);
  gate.resolve(undefined);
  await rejected;
  expect(client.status).toBe("connected");
  await client.close();
});
