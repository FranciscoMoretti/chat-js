import { expect, it, vi } from "vitest";

import { createOAuthSession } from "./mcp-queries";

const mocks = vi.hoisted(() => ({
  prune: vi.fn(),
  returning: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/db/client", () => ({
  db: {
    delete: (): { where: typeof mocks.prune } => ({ where: mocks.prune }),
    insert: (): { values: () => { returning: typeof mocks.returning } } => ({
      values: (): { returning: typeof mocks.returning } => ({
        returning: mocks.returning,
      }),
    }),
  },
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: (): { warn: typeof mocks.warn } => ({
    warn: mocks.warn,
  }),
}));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

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
