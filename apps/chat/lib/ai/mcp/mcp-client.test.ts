import { beforeEach, expect, it, vi } from "vitest";
import { MCPClient } from "./mcp-client";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  close: vi.fn(),
  tools: vi.fn(),
}));
vi.mock("@ai-sdk/mcp", () => ({
  experimental_createMCPClient: mocks.create,
  auth: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { appPrefix: "chatjs" } }));
vi.mock("@/lib/url", () => ({ getBaseUrl: () => "http://localhost:3790" }));
vi.mock("./mcp-oauth-provider", () => ({
  McpOAuthClientProvider: class {},
  OAuthAuthorizationRequiredError: class extends Error {},
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
    url: "https://mcp.test",
    type: "http",
    headers: { Authorization: "test" },
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
        type: "http",
        headers: { Authorization: "test" },
      }),
    })
  );
});

it("notifies the web owner after disconnect and authentication errors", async () => {
  const invalidate = vi.fn();
  const client = new MCPClient(
    "id",
    "Test",
    { url: "https://mcp.test", type: "sse" },
    invalidate
  );
  await client.connect();
  mocks.tools.mockRejectedValueOnce(new Error("401 Unauthorized"));
  await expect(client.tools()).rejects.toThrow("401 Unauthorized");
  expect(invalidate).toHaveBeenCalledOnce();
  await client.close();
  expect(invalidate).toHaveBeenCalledTimes(2);
});
