import { beforeEach, expect, it, vi } from "vitest";

import { getOrCreateMcpClient, removeMcpClient } from "./mcp-client-manager";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  invalidate: vi.fn(),
  state: { status: "authorizing", url: "https://auth.test?state=active" },
}));
vi.mock("./cache", () => ({ invalidateAllMcpCaches: mocks.invalidate }));
vi.mock("./mcp-client", () => ({
  MCPClient: class {
    state = mocks.state;
    get status() {
      return this.state.status;
    }
    getAuthorizationUrl() {
      return new URL(this.state.url);
    }
    close = mocks.close;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.status = "authorizing";
  mocks.state.url = "https://auth.test?state=active";
});
const connector = (id: string) => ({
  id,
  name: "Server",
  type: "http" as const,
  url: "https://mcp.test",
});

it("a failed state cannot remove another active authorization", async () => {
  const config = connector("other-state");
  const client = getOrCreateMcpClient(config);
  await removeMcpClient(config.id, "failed");
  expect(getOrCreateMcpClient(config)).toBe(client);
  expect(mocks.close).not.toHaveBeenCalled();
});
it("a failed state cannot close an established connection", async () => {
  mocks.state.status = "connected";
  const config = connector("connected");
  const client = getOrCreateMcpClient(config);
  await removeMcpClient(config.id, "active");
  expect(getOrCreateMcpClient(config)).toBe(client);
  expect(mocks.close).not.toHaveBeenCalled();
});
it("the matching authorizing client is removed and closed", async () => {
  const config = connector("matching");
  const client = getOrCreateMcpClient(config);
  await removeMcpClient(config.id, "active");
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(getOrCreateMcpClient(config)).not.toBe(client);
});
