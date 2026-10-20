import { beforeEach, expect, it, vi } from "vitest";
import {
  manageEveLocalResources,
  verifyLocalEveFamilyCoverage,
} from "./verify-local-coverage";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  resolve: vi.fn(),
  retire: vi.fn(),
  cleanup: vi.fn(),
  end: vi.fn(),
  verify: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../sandbox/runtime", () => ({
  getPersistentSandboxProvider: () => ({
    scope: { providerId: "vercel", accountId: "account", scopeId: "project" },
    persistent: { deleteAndConfirmAbsent: mocks.remove },
  }),
}));
vi.mock("./persistent-sandbox-store", () => ({
  readPersistentIdentity: mocks.identity,
  resolvePersistentIdentity: mocks.resolve,
  retirePersistentSession: mocks.retire,
  cleanupPersistentSession: mocks.cleanup,
}));
vi.mock("postgres", () => ({ default: () => ({ end: mocks.end }) }));
vi.mock("node:fs/promises", () => ({
  realpath: async () => await Promise.resolve("/worker"),
}));
vi.mock("@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof", () => ({
  verifyEveSandboxCoverage: mocks.verify,
}));
vi.mock("../env", () => ({
  env: { WORKFLOW_POSTGRES_URL: "postgresql://localhost" },
}));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
const inventories = [{ sessionId: "root", runIds: ["root", "child"] }];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue(["root", "child"]);
  mocks.identity.mockImplementation(
    async (sessionId: string) =>
      await Promise.resolve({
        ownerId: "owner",
        sessionId,
        rootSessionId: "root",
      })
  );
});
it("rechecks app ownership for all descendants when workflow coverage was retained", async () => {
  expect(
    await verifyLocalEveFamilyCoverage("owner", "/expected", inventories)
  ).toEqual({
    appRoot: "/worker",
    sessions: [
      { sessionId: "root", rootSessionId: "root" },
      { sessionId: "child", rootSessionId: "root" },
    ],
  });
  expect(mocks.retire).toHaveBeenCalledTimes(2);
  expect(mocks.cleanup).not.toHaveBeenCalled();
  expect(mocks.end).toHaveBeenCalledOnce();
});
it.each([
  { ownerId: "foreign", sessionId: "root", rootSessionId: "root" },
  { ownerId: "owner", sessionId: "root", rootSessionId: "foreign" },
])("rejects mismatched ownership: %j", async (identity) => {
  mocks.identity.mockResolvedValue(identity);
  await expect(
    verifyLocalEveFamilyCoverage("owner", "/expected", inventories)
  ).rejects.toThrow("coverage is unavailable");
  expect(mocks.retire).not.toHaveBeenCalled();
  expect(mocks.cleanup).not.toHaveBeenCalled();
  expect(mocks.end).toHaveBeenCalledOnce();
});
it("propagates retirement failures instead of accepting cleanup coverage", async () => {
  mocks.retire.mockRejectedValue(new Error("retirement failed"));
  await expect(
    verifyLocalEveFamilyCoverage("owner", "/expected", inventories)
  ).rejects.toThrow("retirement failed");
  expect(mocks.end).toHaveBeenCalledOnce();
});
it("retires before purging and propagates unconfirmed deletion", async () => {
  mocks.cleanup.mockRejectedValue(new Error("absence unconfirmed"));
  await expect(
    manageEveLocalResources(
      "owner",
      { sessionId: "child", rootSessionId: "root" },
      "purge"
    )
  ).rejects.toThrow("absence unconfirmed");
  expect(mocks.retire.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.cleanup.mock.invocationCallOrder[0]
  );
  expect(mocks.cleanup).toHaveBeenCalledWith(
    { ownerId: "owner", sessionId: "child", rootSessionId: "root" },
    expect.any(Function)
  );
});

it("retires a verified native session that never allocated an app filesystem", async () => {
  mocks.identity.mockResolvedValue(null);
  mocks.resolve.mockResolvedValue({
    ownerId: "owner",
    sessionId: "child",
    rootSessionId: "root",
    workspaceId: "workspace",
  });
  await manageEveLocalResources(
    "owner",
    { sessionId: "child", rootSessionId: "root" },
    "purge"
  );
  expect(mocks.retire).toHaveBeenCalledWith({
    ownerId: "owner",
    sessionId: "child",
    rootSessionId: "root",
    workspaceId: "workspace",
  });
  expect(mocks.cleanup).toHaveBeenCalledWith(
    {
      ownerId: "owner",
      sessionId: "child",
      rootSessionId: "root",
      workspaceId: "workspace",
    },
    expect.any(Function)
  );
});
