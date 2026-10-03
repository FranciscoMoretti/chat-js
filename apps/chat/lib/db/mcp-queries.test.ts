import { expect, it, vi } from "vitest";

import { createOAuthSession } from "./mcp-queries";

const mocks = vi.hoisted(() => ({
  prune: vi.fn(),
  returning: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: {} }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/db/client")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/db/client", () => ({
  db: {
    delete: () => ({ where: mocks.prune }),
    insert: () => ({ values: () => ({ returning: mocks.returning }) }),
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/logger")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ warn: mocks.warn }),
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("creates a new OAuth attempt even if expired-attempt cleanup fails") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("creates a new OAuth attempt even if expired-attempt cleanup fails", async () => {
  const error = new Error("cleanup failed");
  mocks.prune.mockRejectedValue(error);
  const session = { id: "new-session", state: "new-state" };
  mocks.returning.mockResolvedValue([session]);
  await expect(
    createOAuthSession({
      mcpConnectorId: "connector",
      serverUrl: "https://docs.example.test/mcp",
      state: "new-state",
    })
  ).resolves.toEqual(session);
  expect(mocks.warn).toHaveBeenCalledWith(
    { err: error, mcpConnectorId: "connector" },
    "Could not clean up expired OAuth sessions"
  );
});
/* oxlint-enable oxc/no-async-await */
