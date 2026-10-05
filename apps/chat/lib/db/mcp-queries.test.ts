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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

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
