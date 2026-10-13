import { beforeEach, expect, it, vi } from "vitest";

import { MCPClient } from "./mcp-client";
import type { MCPClientConfig } from "@ai-sdk/mcp";
import type { McpOAuthClientProvider } from "./mcp-oauth-provider";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const mocks = vi.hoisted(() => ({
  close: vi.fn<() => Promise<void>>(),
  create: vi.fn<
    (
      config: ReadonlyNativeSurface<
        MCPClientConfig & {
          initializationOptions: { signal: AbortSignal };
          transport: { authProvider: unknown };
        }
      >
    ) => Promise<unknown>
  >(),
  provider:
    vi.fn<
      (
        ...options: ReadonlyNativeSurface<
          ConstructorParameters<typeof McpOAuthClientProvider>
        >
      ) => unknown
    >(),
  tools: vi.fn(),
}));
vi.mock("@ai-sdk/mcp", () => ({
  auth: vi.fn(),
  experimental_createMCPClient: mocks.create,
}));
vi.mock("@/lib/config", () => ({ config: { appPrefix: "chatjs" } }));

vi.mock("@/lib/url", () => ({
  getBaseUrl: (): string => "http://localhost:3790",
}));

vi.mock("./mcp-oauth-provider", () => ({
  McpOAuthClientProvider: mocks.provider,
}));
vi.mock("./cache", () => {
  throw new Error("Runtime client must not load Next.js cache APIs");
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.close.mockResolvedValue();
  mocks.tools.mockResolvedValue({});
  mocks.create.mockResolvedValue({ close: mocks.close, tools: mocks.tools });
  mocks.provider.mockImplementation(
    function provider(this: { fetch: typeof fetch }) {
      this.fetch = vi.fn<typeof fetch>();
    }
  );
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
  expect(mocks.create.mock.calls).toMatchObject([
    [{ transport: { headers: { Authorization: "test" }, type: "http" } }],
  ]);
});
it("notifies the web owner after disconnect and authentication errors", async () => {
  const invalidate = vi.fn<() => void>();
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
  const gate: PromiseWithResolvers<void> = Promise.withResolvers();
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
  gate.resolve();
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
  const invalidate = vi.fn<() => void>();
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
  expect(mocks.provider.mock.calls).toMatchObject([
    [
      {
        clientMetadata: { token_endpoint_auth_method: "client_secret_basic" },
        oauthClientId: "configured-id",
        oauthClientSecret: "configured-secret",
      },
    ],
  ]);
  expect(mocks.create.mock.calls).toMatchObject([
    [{ transport: { headers: undefined } }],
  ]);
  await client.close();
});

it("closing an in-flight connection prevents the late transport from becoming active", async () => {
  const gate: PromiseWithResolvers<void> = Promise.withResolvers();
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
  gate.resolve();
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
  const { signal } = mocks.create.mock.calls[0][0].initializationOptions;
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal).toHaveProperty("aborted", false);
  await client.close();
  expect(signal).toHaveProperty("aborted", true);
});

it("callers cancel their shared connection waits independently", async () => {
  const gate: PromiseWithResolvers<void> = Promise.withResolvers();
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
  const first = client.connect({ abortSignal: firstAbort.signal });
  const second = client.connect({ abortSignal: secondAbort.signal });
  firstAbort.abort(new Error("first cancelled"));
  await expect(first).rejects.toThrow("first cancelled");
  expect(
    mocks.create.mock.calls[0][0].initializationOptions.signal.aborted
  ).toBe(false);
  gate.resolve();
  await second;
  expect(client.status).toBe("connected");
  expect(mocks.create).toHaveBeenCalledOnce();
  await client.close();
});

it("cleans up a failed shared attempt after its only caller cancels", async () => {
  const initialization = Promise.withResolvers<never>();
  mocks.create.mockReturnValueOnce(initialization.promise);
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  const controller = new AbortController();
  const waiting = client.connect({ abortSignal: controller.signal });
  controller.abort(new Error("caller cancelled"));
  await expect(waiting).rejects.toThrow("caller cancelled");
  initialization.reject(new Error("shared initialization failed"));
  await vi.waitFor(() => {
    expect(client.status).toBe("disconnected");
  });
  await client.connect();
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(client.status).toBe("connected");
  await client.close();
});

it("a fresh connection starts immediately after closing a pending attempt", async () => {
  const gate: PromiseWithResolvers<void> = Promise.withResolvers();
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
  gate.resolve();
  await rejected;
  expect(client.status).toBe("connected");
  await client.close();
});

it("a retired attempt cannot clear a replacement that is still connecting", async () => {
  const retired = Promise.withResolvers<never>();
  const replacement = Promise.withResolvers<{
    close: typeof mocks.close;
    tools: typeof mocks.tools;
  }>();
  mocks.create
    .mockReturnValueOnce(retired.promise)
    .mockReturnValueOnce(replacement.promise);
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  const first = client.connect();
  const rejected = expect(first).rejects.toThrow("retired connection failed");
  await client.close();
  const second = client.connect();
  retired.reject(new Error("retired connection failed"));
  await rejected;
  const third = client.connect();
  expect(mocks.create).toHaveBeenCalledTimes(2);
  replacement.resolve({ close: mocks.close, tools: mocks.tools });
  await Promise.all([second, third]);
  expect(client.status).toBe("connected");
  await client.close();
  expect(mocks.close).toHaveBeenCalledOnce();
});

it.each(["tools", "listResources", "listPrompts"] as const)(
  "a retired client's late %s auth error cannot close its replacement",
  async (method) => {
    const gate = Promise.withResolvers<never>();
    const oldMethod = vi.fn().mockReturnValue(gate.promise);
    const oldClose = vi.fn();
    const replacementClose = vi.fn();
    const invalidate = vi.fn<() => void>();
    mocks.create
      .mockResolvedValueOnce({
        close: oldClose,
        experimental_listPrompts: oldMethod,
        listResources: oldMethod,
        tools: oldMethod,
      })
      .mockResolvedValueOnce({ close: replacementClose, tools: mocks.tools });
    const client = new MCPClient(
      "id",
      "Test",
      { type: "http", url: "https://mcp.test" },
      invalidate
    );
    await client.connect();
    const pending = client[method]();
    const rejected = expect(pending).rejects.toThrow("401 Unauthorized");
    await client.close();
    await client.connect();
    gate.reject(new Error("401 Unauthorized"));
    await rejected;
    expect(client.status).toBe("connected");
    expect(replacementClose).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledOnce();
    await client.close();
  }
);

it("a retired provider's late OAuth redirect cannot authorise or close its replacement", async () => {
  const gate: PromiseWithResolvers<void> = Promise.withResolvers();
  mocks.create.mockImplementationOnce(async () => {
    const [[providerConfig]] = mocks.provider.mock.calls;
    await gate.promise;
    await providerConfig.onRedirectToAuthorization(
      new URL("https://auth.test?state=retired")
    );
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
  expect(mocks.create.mock.calls[0][0].transport.authProvider).not.toBe(
    mocks.create.mock.calls[1][0].transport.authProvider
  );
  gate.resolve();
  await rejected;
  expect(client.getAuthorizationUrl()).toBeUndefined();
  expect(client.status).toBe("connected");
  expect(mocks.close).not.toHaveBeenCalled();
  await client.close();
});
