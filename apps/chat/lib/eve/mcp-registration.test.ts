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
vi.mock("eve/tools", () => ({
  defineDynamic: <Value>(value: Value): Value => value,
  defineTool: <Value>(value: Value): Value => value,
}));
vi.mock("./mcp-tools", () => ({
  discoverEveMcpTools: mocks.discover,
  executeEveMcpTool: mocks.execute,
}));

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling mcp.events["step.started"]; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */

afterEach(() => vi.restoreAllMocks());

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling mcp.events["step.started"]; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./turn-tools")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): vi.mock("./turn-tools") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
vi.mock("./turn-tools", () => ({
  eveTurnGuest: { get: (): boolean => mocks.guest },
  eveTurnTool: {
    get: () => {
      if (mocks.selected) {
        return "webSearch";
      }
      return null;
    },
  },
}));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("does not discover remote tools for an explicitly selected local capability") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("does not discover remote tools for an explicitly selected local capability", async () => {
  mocks.selected = true;
  mocks.discover.mockClear();
  try {
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling mcp.events["step.started"]; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("never discovers registered account connectors for a guest") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("never discovers registered account connectors for a guest", async () => {
  mocks.guest = true;
  mocks.discover.mockClear();
  try {
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling mcp.events["step.started"]; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
