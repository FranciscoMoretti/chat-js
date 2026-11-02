import { dynamicEvaluate } from "@eve-test/dist/src/dynamic/definition.js";
import { testDynamicContext } from "../../tests/helpers/eve-dynamic-context";
import { afterEach, expect, it, vi } from "vitest";

import mcp from "../../agent/tools/mcp";

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  execute: vi.fn(),
  guest: false,
  selected: false,
}));
vi.mock("../../chatjs/plugins/mcp/runtime/mcp-tools", () => ({
  discoverEveMcpTools: mocks.discover,
  executeEveMcpTool: mocks.execute,
}));

const ownerContext = () =>
  testDynamicContext({
    session: {
      id: "session",
      auth: {
        current: null,
        initiator: {
          attributes: {},
          authenticator: "chatjs-gateway",
          principalId: "owner",
          principalType: "user",
        },
      },
    },
  });

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
  const definitions = await dynamicEvaluate(mcp)(ownerContext());
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
  await expect(dynamicEvaluate(mcp)(ownerContext())).resolves.toEqual({});
  expect(mocks.discover).toHaveBeenCalled();
});

vi.mock("./turn-tools", () => ({
  eveTurnAccount: { get: (): boolean => !mocks.guest },
  eveTurnTool: {
    get: () => {
      if (mocks.selected) {
        return "webSearch";
      }
      return null;
    },
  },
}));

it("does not discover remote tools for an explicitly selected local capability", async () => {
  mocks.selected = true;
  mocks.discover.mockClear();
  try {
    expect(await dynamicEvaluate(mcp)(ownerContext())).toEqual({});
    expect(mocks.discover).not.toHaveBeenCalled();
  } finally {
    mocks.selected = false;
  }
});

it("never discovers registered account connectors for a guest", async () => {
  mocks.guest = true;
  mocks.discover.mockClear();
  try {
    expect(await dynamicEvaluate(mcp)(testDynamicContext())).toEqual({});
    expect(mocks.discover).not.toHaveBeenCalled();
  } finally {
    mocks.guest = false;
  }
});
