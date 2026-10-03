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

vi.mock("@/lib/url", () => ({
  getBaseUrl: (): string => "http://localhost:3790",
}));

vi.mock("./mcp-oauth-provider", () => ({
  McpOAuthClientProvider: mocks.provider,
}));
vi.mock("./cache", () => {
  throw new Error("Runtime client must not load Next.js cache APIs");
});

/* oxlint-disable no-undefined --
 * no-undefined (#519): beforeEach uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
beforeEach(() => {
  vi.clearAllMocks();
  mocks.close.mockResolvedValue(undefined);
  mocks.tools.mockResolvedValue({});
  mocks.create.mockResolvedValue({ close: mocks.close, tools: mocks.tools });
});
/* oxlint-enable no-undefined */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("connects, discovers and closes without web cache dependencies") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      transport: expect.objectContaining({
        headers: { Authorization: "test" },
        type: "http",
      }),
    })
  );
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/strict-void-return --
 * no-magic-numbers (#517): it("notifies the web owner after disconnect and authentication errors") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("notifies the web owner after disconnect and authentication errors") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/strict-void-return (#611): it("notifies the web owner after disconnect and authentication errors")'s void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/strict-void-return */

/* oxlint-disable no-undefined, oxc/no-async-await --
 * no-undefined (#519): it("concurrent connection requests share one transport and close it once") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("concurrent connection requests share one transport and close it once") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable no-undefined, oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): it("a failed connection can be retried without retaining a failed promise") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("a failed connection can be retried without retaining a failed promise") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable oxc/no-async-await, typescript/strict-void-return --
 * oxc/no-async-await (#540): it("domain errors mentioning tokens do not invalidate authentication") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/strict-void-return (#611): it("domain errors mentioning tokens do not invalidate authentication")'s void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
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
/* oxlint-enable oxc/no-async-await, typescript/strict-void-return */

/* oxlint-disable no-undefined, oxc/no-async-await --
 * no-undefined (#519): it("OAuth secrets go to the provider and never the resource transport") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("OAuth secrets go to the provider and never the resource transport") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      clientMetadata: expect.objectContaining({
        token_endpoint_auth_method: "client_secret_basic",
      }),
      oauthClientId: "configured-id",
      oauthClientSecret: "configured-secret",
    })
  );
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      transport: expect.objectContaining({ headers: undefined }),
    })
  );
  await client.close();
});
/* oxlint-enable no-undefined, oxc/no-async-await */

/* oxlint-disable no-undefined, oxc/no-async-await --
 * no-undefined (#519): it("closing an in-flight connection prevents the late transport from becoming active" uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("closing an in-flight connection prevents the late transport from becoming active" sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable no-undefined, oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining --
 * no-magic-numbers (#517): it("connection initialization always receives a cancellation signal") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("connection initialization always receives a cancellation signal") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): it("connection initialization always receives a cancellation signal") handles optional mocks.create.mock.calls[0]?.[0].initializationOptions.signal without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
it("connection initialization always receives a cancellation signal", async () => {
  const client = new MCPClient("id", "Test", {
    type: "http",
    url: "https://mcp.test",
  });
  await client.connect();
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-member-access -- #595: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  const signal = mocks.create.mock.calls[0]?.[0].initializationOptions.signal;
  expect(signal).toBeInstanceOf(AbortSignal);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(signal.aborted).toBe(false);
  await client.close();
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(signal.aborted).toBe(true);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await --
 * max-statements (#512): it("callers cancel their shared connection waits independently") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("callers cancel their shared connection waits independently") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("callers cancel their shared connection waits independently") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("callers cancel their shared connection waits independently") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    mocks.create.mock.calls[0][0].initializationOptions.signal.aborted
  ).toBe(false);
  gate.resolve(undefined);
  await second;
  expect(client.status).toBe("connected");
  expect(mocks.create).toHaveBeenCalledOnce();
  await client.close();
});
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await --
 * max-statements (#512): it("a fresh connection starts immediately after closing a pending attempt") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("a fresh connection starts immediately after closing a pending attempt") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("a fresh connection starts immediately after closing a pending attempt") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("a fresh connection starts immediately after closing a pending attempt") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await */

/* oxlint-disable max-statements, oxc/no-async-await, typescript/promise-function-async, typescript/strict-void-return --
 * max-statements (#512): it.each(["tools", "listResources", "listPrompts"] as const)("a retired client's late  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): it.each(["tools", "listResources", "listPrompts"] as const)("a retired client's late  sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): it.each(["tools", "listResources", "listPrompts"] as const)("a retired client's late  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-void-return (#611): it.each(["tools", "listResources", "listPrompts"] as const)("a retired client's late 's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
it.each(["tools", "listResources", "listPrompts"] as const)(
  "a retired client's late %s auth error cannot close its replacement",
  async (method) => {
    const gate = Promise.withResolvers<never>();
    const oldMethod = vi.fn(() => gate.promise);
    const oldClose = vi.fn();
    const replacementClose = vi.fn();
    const invalidate = vi.fn();
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
/* oxlint-enable max-statements, oxc/no-async-await, typescript/promise-function-async, typescript/strict-void-return */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await --
 * max-statements (#512): it("a retired provider's late OAuth redirect cannot authorise or close its replacemen keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("a retired provider's late OAuth redirect cannot authorise or close its replacemen uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("a retired provider's late OAuth redirect cannot authorise or close its replacemen uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("a retired provider's late OAuth redirect cannot authorise or close its replacemen sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("a retired provider's late OAuth redirect cannot authorise or close its replacement", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.create.mockImplementationOnce(async () => {
    const [[providerConfig]] = mocks.provider.mock.calls;
    await gate.promise;
    // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access -- #596: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
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
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.create.mock.calls[0][0].transport.authProvider).not.toBe(
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This mcp-client fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    mocks.create.mock.calls[1][0].transport.authProvider
  );
  gate.resolve(undefined);
  await rejected;
  expect(client.getAuthorizationUrl()).toBeUndefined();
  expect(client.status).toBe("connected");
  expect(mocks.close).not.toHaveBeenCalled();
  await client.close();
});
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await */
