import { afterEach, expect, it, vi } from "vitest";
import mcp from "../../agent/tools/mcp";

const mocks = vi.hoisted(() => ({ discover: vi.fn(), execute: vi.fn() }));
vi.mock("eve/tools", () => ({
  defineDynamic: <T>(value: T) => value,
  defineTool: <T>(value: T) => value,
}));
vi.mock("./mcp-tools", () => ({
  discoverEveMcpTools: mocks.discover,
  executeEveMcpTool: mocks.execute,
}));

it("discovers for the session owner and preserves namespaced tool definitions", async () => {
  mocks.discover.mockResolvedValue([
    {
      name: "server__echo",
      connectorId: "connector",
      remoteName: "echo",
      description: "Echo",
      inputSchema: { type: "object", properties: {} },
    },
  ]);
  const definitions = await mcp.events["step.started"]?.(
    {},
    {
      session: {
        id: "session",
        auth: {
          current: null,
          initiator: {
            principalId: "owner",
            principalType: "user",
            authenticator: "test",
            attributes: {},
          },
        },
      },
      channel: {},
      messages: [],
    }
  );
  expect(mocks.discover).toHaveBeenCalledWith("owner", expect.any(AbortSignal));
  expect(definitions).toMatchObject({
    server__echo: { description: "Echo", inputSchema: { type: "object" } },
  });
  expect(JSON.stringify(definitions)).not.toContain("connectorId");
});

afterEach(() => vi.restoreAllMocks());

it("continues ordinary chat when MCP discovery times out", async () => {
  const signal = AbortSignal.abort(
    new DOMException("Timed out", "TimeoutError")
  );
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
  mocks.discover.mockRejectedValue(signal.reason);
  await expect(
    mcp.events["step.started"]?.(
      {},
      {
        session: { id: "session", auth: { current: null, initiator: null } },
        channel: {},
        messages: [],
      }
    )
  ).resolves.toEqual({});
});
