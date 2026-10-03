/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

import { GET } from "@/app/api/mcp/oauth/callback/route";
import { MissingCredentialsError } from "@/lib/required-credentials";
/* oxlint-enable sort-imports */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): mocks preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  getSession: vi.fn(),
  invalidate: vi.fn(),
  params: {
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- #591: This controlled fixture models the mocked boundary explicitly; changing its widening or coercion requires preserving the exercised failure scenario.
    code: "code" as string | null,
    error: null as string | null,
    error_description: null as string | null,
    state: "state",
  },
  removeClient: vi.fn(),
  requireCredentials: vi.fn(),
}));
/* oxlint-enable unicorn/no-null */
vi.mock("@/features/mcp/setup", () => ({
  requireMcpCredentials: mocks.requireCredentials,
}));
vi.mock("@/lib/ai/mcp/mcp-client-manager", () => ({
  createMcpClientForCallback: vi.fn(),
  removeMcpClient: mocks.removeClient,
}));
vi.mock("@/lib/ai/mcp/cache", () => ({
  invalidateAllMcpCaches: mocks.invalidate,
}));
vi.mock("@/lib/db/mcp-queries", () => ({
  deletePendingSessionByState: mocks.deleteSession,
  getMcpConnectorById: vi.fn(),
  getSessionByState: mocks.getSession,
}));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/logger")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ error: vi.fn(), info: vi.fn() }),
}));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/nuqs/mcp-search-params.server")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/nuqs/mcp-search-params.server", () => ({
  loadMcpOAuthCallbackSearchParams: () => mocks.params,
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): beforeEach preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.params = {
    code: "code",
    error: null,
    error_description: null,
    state: "state",
  };
});
/* oxlint-enable unicorn/no-null */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): it("redirects an OAuth callback with an explicit setup error before accessing connect uses 307 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("redirects an OAuth callback with an explicit setup error before accessing connect sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("redirects an OAuth callback with an explicit setup error before accessing connector secrets", async () => {
  mocks.requireCredentials.mockImplementation(() => {
    throw new MissingCredentialsError("mcp", [
      { options: [["MCP_ENCRYPTION_KEY"]] },
    ]);
  });
  const response = await GET(
    new NextRequest(
      "https://chat.example.test/api/mcp/oauth/callback?code=code&state=state"
    )
  );
  expect(response.status).toBe(307);
  const location = new URL(response.headers.get("location") ?? "");
  expect(location.pathname).toBe("/settings/connectors");
  expect(location.searchParams.get("error")).toBe(
    "Missing credentials for mcp: MCP_ENCRYPTION_KEY"
  );
  expect(mocks.getSession).not.toHaveBeenCalled();
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable max-statements, oxc/no-async-await, unicorn/no-null --
 * max-statements (#512): it("provider cancellation deletes only pending state and returns a safe connector-sco keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): it("provider cancellation deletes only pending state and returns a safe connector-sco sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/no-null (#570): it("provider cancellation deletes only pending state and returns a safe connector-sco preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("provider cancellation deletes only pending state and returns a safe connector-scoped message", async () => {
  mocks.params = {
    code: null,
    error: "access_denied",
    error_description: "secret provider detail",
    state: "state",
  };
  const pending = { mcpConnectorId: "connector", state: "state", tokens: null };
  mocks.getSession.mockResolvedValue(pending);
  mocks.deleteSession.mockResolvedValue(pending);
  const response = await GET(
    new NextRequest(
      "https://chat.example.test/api/mcp/oauth/callback?error=access_denied&state=state"
    )
  );
  const location = new URL(response.headers.get("location") ?? "");
  expect(location.pathname).toBe("/settings/connectors/connector");
  expect(location.searchParams.get("error")).toBe(
    "Authorization was not completed. Please try connecting again."
  );
  expect(location.toString()).not.toContain("secret");
  expect(mocks.deleteSession).toHaveBeenCalledWith({ state: "state" });
  expect(mocks.removeClient).toHaveBeenCalledWith("connector", "state");
  expect(mocks.invalidate).toHaveBeenCalledWith("connector");
});
/* oxlint-enable max-statements, oxc/no-async-await, unicorn/no-null */

/* oxlint-disable no-ternary, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * no-ternary (#518): it.each([ undefined, { mcpConnectorId: "connector", state: "state", tokens: { access_ derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): it.each([ undefined, { mcpConnectorId: "connector", state: "state", tokens: { access_ uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it.each([ undefined, { mcpConnectorId: "connector", state: "state", tokens: { access_ sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it.each([ undefined, { mcpConnectorId: "connector", state: "state", tokens: { access_ accepts session; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): it.each([ undefined, { mcpConnectorId: "connector", state: "state", tokens: { access_ preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it.each([
  undefined,
  {
    mcpConnectorId: "connector",
    state: "state",
    tokens: { access_token: "active" },
  },
])(
  "provider errors do not delete an authenticated or unmatched session: %j",
  async (session) => {
    mocks.params = {
      code: null,
      error: "access_denied",
      error_description: null,
      state: "state",
    };
    mocks.getSession.mockResolvedValue(session);
    const response = await GET(
      new NextRequest(
        "https://chat.example.test/api/mcp/oauth/callback?error=access_denied&state=state"
      )
    );
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe(
      session ? "/settings/connectors/connector" : "/settings/connectors"
    );
    expect(mocks.deleteSession).not.toHaveBeenCalled();
    expect(mocks.removeClient).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  }
);
/* oxlint-enable no-ternary, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable no-undefined, oxc/no-async-await, unicorn/no-null --
 * no-undefined (#519): it("an attempt completed between lookup and deletion retains its client") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("an attempt completed between lookup and deletion retains its client") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/no-null (#570): it("an attempt completed between lookup and deletion retains its client") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("an attempt completed between lookup and deletion retains its client", async () => {
  mocks.params = {
    code: null,
    error: "access_denied",
    error_description: null,
    state: "state",
  };
  mocks.getSession.mockResolvedValue({
    mcpConnectorId: "connector",
    state: "state",
    tokens: null,
  });
  mocks.deleteSession.mockResolvedValue(undefined);
  await GET(
    new NextRequest(
      "https://chat.example.test/api/mcp/oauth/callback?error=access_denied&state=state"
    )
  );
  expect(mocks.removeClient).not.toHaveBeenCalled();
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
/* oxlint-enable no-undefined, oxc/no-async-await, unicorn/no-null */
