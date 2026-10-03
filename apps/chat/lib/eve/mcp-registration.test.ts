/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../agent/tools/mcp" dependency within this package instead of introducing an alias or barrel API.
 */
import { afterEach, expect, it, vi } from "vitest";

import mcp from "../../agent/tools/mcp";
/* oxlint-enable import/no-relative-parent-imports */

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  execute: vi.fn(),
  guest: false,
  selected: false,
}));
/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): vi.mock("eve/tools") uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/tools")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("eve/tools", () => ({
  defineDynamic: <T>(value: T) => value,
  defineTool: <T>(value: T) => value,
}));
/* oxlint-enable id-length, typescript/explicit-function-return-type */
vi.mock("./mcp-tools", () => ({
  discoverEveMcpTools: mocks.discover,
  executeEveMcpTool: mocks.execute,
}));

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("discovers for the session owner and preserves namespaced tool definitions") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */

afterEach(() => vi.restoreAllMocks());

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("continues ordinary chat when MCP discovery times out") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./turn-tools")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): vi.mock("./turn-tools") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
vi.mock("./turn-tools", () => ({
  eveTurnGuest: { get: (): boolean => mocks.guest },
  eveTurnTool: { get: () => (mocks.selected ? "webSearch" : null) },
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("does not discover remote tools for an explicitly selected local capability") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("never discovers registered account connectors for a guest") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */
