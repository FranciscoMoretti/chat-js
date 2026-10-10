import { beforeEach, expect, it, vi } from "vitest";

import {
  retireEveFamilyForDeletion,
  retireEveSessionForDeletion,
} from "./retire-session";

/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): vi.mock("./reconcile-usage") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("./reconcile-usage", () => ({
  reconcileEveSubagentUsage: vi.fn(() => Promise.resolve(true)),
}));
/* oxlint-enable typescript/promise-function-async */

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  check: vi.fn(),
  client: vi.fn(),
  deleting: vi.fn(),
  env: {
    EVE_GATEWAY_SECRET: "fixture",
    EVE_INTERNAL_ORIGIN: "http://localhost",
    VERCEL: "",
    VERCEL_ENV: "",
    WORKFLOW_POSTGRES_URL: "postgres://localhost/fixture",
  },
  provider: vi.fn(),
  reset: vi.fn(),
  retireMany: vi.fn(),
  snapshot: vi.fn(),
  usage: vi.fn(),
}));
vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
vi.mock("../db/eve-queries", () => ({
  beginEveConversationDeletion: mocks.begin,
  getDeletingEveConversationForSession: mocks.deleting,
}));
vi.mock("./lifecycle/provider", () => ({
  createEveLifecycleProvider: mocks.provider,
}));
vi.mock("./usage", () => ({ ingestEveUsage: mocks.usage }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/client")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("eve/client", () => ({
  Client: class {
    public constructor(options: unknown) {
      mocks.client(options);
    }
    public sessions = {
      attach: () => ({ reset: mocks.reset, snapshot: mocks.snapshot }),
    };
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable no-undefined --
 * no-undefined (#519): beforeEach uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
beforeEach(() => {
  vi.clearAllMocks();
  mocks.check.mockReset();
  mocks.env.VERCEL = "";
  mocks.env.VERCEL_ENV = "";
  mocks.provider.mockReturnValue({
    check: mocks.check,
    retire: mocks.retireMany,
    supported: true,
  });
  mocks.deleting.mockResolvedValue({ id: "conversation" });
  mocks.reset.mockResolvedValue({ status: "reset" });
  mocks.snapshot.mockResolvedValue({ events: [{ type: "session.completed" }] });
  mocks.usage.mockResolvedValue(undefined);
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("retires before reading and settling the final snapshot, including retries") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("retires before reading and settling the final snapshot, including retries", async () => {
  await retireEveSessionForDeletion("owner", "session");
  expect(mocks.client).toHaveBeenCalledWith(
    expect.objectContaining({
      headers: { "x-chatjs-deletion": "1", "x-chatjs-owner": "owner" },
    })
  );
  expect(mocks.reset.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.snapshot.mock.invocationCallOrder[0]
  );
  mocks.reset.mockResolvedValue({ status: "no_active_session" });
  await expect(
    retireEveSessionForDeletion("owner", "session")
  ).resolves.toMatchObject({ events: [{ type: "session.completed" }] });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-undefined --
 * no-undefined (#519): it("rejects non-deleting or foreign sessions before native access") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
it("rejects non-deleting or foreign sessions before native access", async () => {
  mocks.deleting.mockResolvedValue(undefined);
  await expect(retireEveSessionForDeletion("owner", "session")).rejects.toThrow(
    "not pending deletion"
  );
  expect(mocks.reset).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

/* oxlint-disable no-undefined, typescript/promise-function-async --
 * no-undefined (#519): it("refuses erasure when retirement or cost settlement is incomplete") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/promise-function-async (#606): it("refuses erasure when retirement or cost settlement is incomplete") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("refuses erasure when retirement or cost settlement is incomplete", async () => {
  mocks.snapshot.mockResolvedValue({ events: [{ type: "step.completed" }] });
  await expect(retireEveSessionForDeletion("owner", "session")).rejects.toThrow(
    "retirement has not completed"
  );
  expect(mocks.usage).not.toHaveBeenCalled();
  mocks.snapshot.mockResolvedValue({
    events: [{ type: "step.completed" }, { type: "session.completed" }],
  });
  mocks.usage.mockImplementation(
    (_owner: string, _session: string, event: { readonly type: string }) =>
      // oxlint-disable-next-line no-ternary -- Keep Promise.resolve argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      Promise.resolve(event.type === "step.completed" ? false : undefined)
  );
  await expect(retireEveSessionForDeletion("owner", "session")).rejects.toThrow(
    "Usage must be reconciled"
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined, typescript/promise-function-async */

/* oxlint-disable no-undefined, unicorn/no-null --
 * no-undefined (#519): it("does not enter native family cleanup for an inaccessible family or a missing sess uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * unicorn/no-null (#570): it("does not enter native family cleanup for an inaccessible family or a missing sess preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("does not enter native family cleanup for an inaccessible family or a missing session binding", async () => {
  mocks.begin.mockResolvedValueOnce(undefined);
  expect(
    await retireEveFamilyForDeletion("stranger", "conversation")
  ).toBeUndefined();
  expect(mocks.retireMany).not.toHaveBeenCalled();
  mocks.begin.mockResolvedValueOnce({
    conversations: [{ id: "root", sessionId: null }],
    rootId: "root",
  });
  await expect(retireEveFamilyForDeletion("owner", "root")).rejects.toThrow(
    "missing session binding"
  );
  expect(mocks.retireMany).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined, unicorn/no-null */

it("rejects PostgreSQL retirement on Vercel before changing application access", async () => {
  mocks.env.VERCEL = "1";
  mocks.env.VERCEL_ENV = "production";
  mocks.provider.mockReturnValue({
    reason: "unverified erasure",
    supported: false,
    world: "vercel",
  });
  await expect(retireEveFamilyForDeletion("owner", "root")).rejects.toThrow(
    "unverified erasure"
  );
  expect(mocks.provider).toHaveBeenCalledWith({
    databaseUrl: mocks.env.WORKFLOW_POSTGRES_URL,
    world: "vercel",
  });
  expect(mocks.check).not.toHaveBeenCalled();
  expect(mocks.begin).not.toHaveBeenCalled();
  expect(mocks.retireMany).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("checks provider compatibility before revoking family access", async () => {
  mocks.check.mockRejectedValueOnce(new Error("workflow fences missing"));
  await expect(retireEveFamilyForDeletion("owner", "root")).rejects.toThrow(
    "workflow fences missing"
  );
  expect(mocks.begin).not.toHaveBeenCalled();
  expect(mocks.retireMany).not.toHaveBeenCalled();
  expect(mocks.reset).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
