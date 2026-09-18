import { afterEach, expect, it, vi } from "vitest";

import mcp from "../../agent/tools/mcp";

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  execute: vi.fn(),
  guest: false,
  selected: false,
}));
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
      connectorId: "connector",
      description: "Echo",
      inputSchema: { properties: {}, type: "object" },
      name: "server__echo",
      remoteName: "echo",
    },
  ]);
  const definitions = await mcp.events["step.started"]?.(
    {},
    {
      channel: {},
      messages: [],
      model: null,
      session: {
        auth: {
          current: null,
          initiator: {
            attributes: {},
            authenticator: "test",
            principalId: "owner",
            principalType: "user",
          },
        },
        id: "session",
      },
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
        channel: {},
        messages: [],
        model: null,
        session: { auth: { current: null, initiator: null }, id: "session" },
      }
    )
  ).resolves.toEqual({});
});

vi.mock("./turn-tools", () => ({
  eveTurnGuest: { get: () => mocks.guest },
  eveTurnTool: { get: () => (mocks.selected ? "webSearch" : null) },
}));

it("does not discover remote tools for an explicitly selected local capability", async () => {
  mocks.selected = true;
  mocks.discover.mockClear();
  try {
    expect(
      await mcp.events["step.started"]?.(
        {},
        {
          channel: {},
          messages: [],
          model: null,
          session: { auth: { current: null, initiator: null }, id: "session" },
        }
      )
    ).toEqual({});
    expect(mocks.discover).not.toHaveBeenCalled();
  } finally {
    mocks.selected = false;
  }
});

it("never discovers registered account connectors for a guest", async () => {
  mocks.guest = true;
  mocks.discover.mockClear();
  try {
    expect(
      await mcp.events["step.started"]?.(
        {},
        {
          channel: {},
          messages: [],
          model: null,
          session: {
            auth: { current: null, initiator: null },
            id: "guest-session",
          },
        }
      )
    ).toEqual({});
    expect(mocks.discover).not.toHaveBeenCalled();
  } finally {
    mocks.guest = false;
  }
});
