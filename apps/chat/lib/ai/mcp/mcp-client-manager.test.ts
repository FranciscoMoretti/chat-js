import { beforeEach, expect, it, vi } from "vitest";

import { getOrCreateMcpClient, removeMcpClient } from "./mcp-client-manager";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  invalidate: vi.fn(),
  state: { status: "authorizing", url: "https://auth.test?state=active" },
}));
vi.mock("./cache", () => ({ invalidateAllMcpCaches: mocks.invalidate }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./mcp-client")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("./mcp-client", () => ({
  MCPClient: class {
    public state = mocks.state;
    public get status() {
      return this.state.status;
    }
    public getAuthorizationUrl() {
      return new URL(this.state.url);
    }
    public close = mocks.close;
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.status = "authorizing";
  mocks.state.url = "https://auth.test?state=active";
});
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep connector's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const connector = (id: string) => ({
  id,
  name: "Server",
  type: "http" as const,
  url: "https://mcp.test",
});
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("a failed state cannot remove another active authorization") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("a failed state cannot remove another active authorization", async () => {
  const config = connector("other-state");
  const client = getOrCreateMcpClient(config);
  await removeMcpClient(config.id, "failed");
  expect(getOrCreateMcpClient(config)).toBe(client);
  expect(mocks.close).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("a failed state cannot close an established connection") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("a failed state cannot close an established connection", async () => {
  mocks.state.status = "connected";
  const config = connector("connected");
  const client = getOrCreateMcpClient(config);
  await removeMcpClient(config.id, "active");
  expect(getOrCreateMcpClient(config)).toBe(client);
  expect(mocks.close).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("the matching authorizing client is removed and closed") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("the matching authorizing client is removed and closed", async () => {
  const config = connector("matching");
  const client = getOrCreateMcpClient(config);
  await removeMcpClient(config.id, "active");
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(getOrCreateMcpClient(config)).not.toBe(client);
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("unconditional removal closes and evicts an established client") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("unconditional removal closes and evicts an established client", async () => {
  mocks.state.status = "connected";
  const config = connector("unconditional");
  const client = getOrCreateMcpClient(config);
  await removeMcpClient(config.id);
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(getOrCreateMcpClient(config)).not.toBe(client);
});
/* oxlint-enable oxc/no-async-await */
