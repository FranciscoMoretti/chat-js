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
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("notifies the web owner after disconnect and authentication errors") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-undefined --
 * no-undefined (#519): it("concurrent connection requests share one transport and close it once") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("a failed connection can be retried without retaining a failed promise") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-undefined --
 * no-undefined (#519): it("OAuth secrets go to the provider and never the resource transport") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

/* oxlint-disable no-undefined --
 * no-undefined (#519): it("closing an in-flight connection prevents the late transport from becoming active" uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("connection initialization always receives a cancellation signal") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("connection initialization always receives a cancellation signal", async () => {
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  await client.connect();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve missing-call detection before asserting the captured initialization signal.
  const signal = mocks.create.mock.calls[0]?.[0].initializationOptions.signal;
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal).toHaveProperty("aborted", false);
  await client.close();
  expect(signal).toHaveProperty("aborted", true);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined --
 * max-statements (#512): it("callers cancel their shared connection waits independently") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("callers cancel their shared connection waits independently") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("callers cancel their shared connection waits independently") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined --
 * max-statements (#512): it("a fresh connection starts immediately after closing a pending attempt") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("a fresh connection starts immediately after closing a pending attempt") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("a fresh connection starts immediately after closing a pending attempt") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["tools", "listResources", "listPrompts"] as const)'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined */

/* oxlint-disable max-statements, typescript/promise-function-async --
 * max-statements (#512): it.each(["tools", "listResources", "listPrompts"] as const)("a retired client's late  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/promise-function-async (#606): it.each(["tools", "listResources", "listPrompts"] as const)("a retired client's late  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it.each(["tools", "listResources", "listPrompts"] as const)(
  "a retired client's late %s auth error cannot close its replacement",
  async (method) => {
    const gate = Promise.withResolvers<never>();
    const oldMethod = vi.fn(() => gate.promise);
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined --
 * max-statements (#512): it("a retired provider's late OAuth redirect cannot authorise or close its replacemen keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("a retired provider's late OAuth redirect cannot authorise or close its replacemen uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("a retired provider's late OAuth redirect cannot authorise or close its replacemen uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
it("a retired provider's late OAuth redirect cannot authorise or close its replacement", async () => {
  const gate = Promise.withResolvers<undefined>();
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
  gate.resolve(undefined);
  await rejected;
  expect(client.getAuthorizationUrl()).toBeUndefined();
  expect(client.status).toBe("connected");
  expect(mocks.close).not.toHaveBeenCalled();
  await client.close();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined */
