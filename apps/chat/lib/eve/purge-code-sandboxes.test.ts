import type { SandboxProvider } from "@chat-js/sandboxes/provider";
import { beforeEach, expect, test, vi } from "vitest";

import { eveCodeSandboxName } from "./code-sandbox-name";
import { purgeEveFamilyCodeSandboxes } from "./purge-code-sandboxes";

const mocks = vi.hoisted(() => ({
  capabilityInstalled: true,
  cleanup: vi.fn<(name: string) => Promise<void>>(),
  createCleanupSession: vi.fn<() => SandboxProvider>(),
  list: vi.fn(),
  record: vi.fn<() => Promise<void>>(),
}));
vi.mock("@/lib/sandbox/runtime", () => ({
  getSandboxProvider: () => {
    if (!mocks.capabilityInstalled) {
      throw new Error("Select a sandbox provider");
    }
    return mocks.createCleanupSession();
  },
}));
vi.mock("../db/eve-code-sandboxes", () => ({
  listEveCodeSandboxesForDeletion: mocks.list,
  recordEveCodeSandboxDeletion: mocks.record,
}));

const provider = {
  providerId: "vercel",
  scopeId: "project",
  accountId: "team",
};
const name = eveCodeSandboxName({
  callId: "call",
  ownerId: "owner",
  provider,
  sessionId: "session",
});
const resource = {
  callId: "call",
  conversationId: "conversation",
  creationConfirmed: true,
  name,
  sessionId: "session",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.capabilityInstalled = true;
  mocks.createCleanupSession.mockReturnValue({
    create: vi.fn(),
    deleteAndConfirmAbsent: mocks.cleanup,
    scope: {
      providerId: "vercel",
      accountId: provider.accountId,
      scopeId: provider.scopeId,
    },
  });
  mocks.list.mockResolvedValue([resource]);

  mocks.record.mockResolvedValue();

  mocks.cleanup.mockResolvedValue();
});

test("cleans confirmed ownership and releases its durable record", async () => {
  await purgeEveFamilyCodeSandboxes("owner", "root");
  expect(mocks.cleanup).toHaveBeenCalledWith(name);
  expect(mocks.record).toHaveBeenCalledWith("owner", "conversation", name);
});
test("a retry accepts provider-confirmed absence", async () => {
  await purgeEveFamilyCodeSandboxes("owner", "root");
  expect(mocks.cleanup).toHaveBeenCalledOnce();
  expect(mocks.record).toHaveBeenCalledOnce();
});
test("unknown creation never uses absence to declare deletion complete", async () => {
  mocks.list.mockResolvedValue([{ ...resource, creationConfirmed: false }]);
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "uncertain code sandbox creation"
  );
  expect(mocks.createCleanupSession).not.toHaveBeenCalled();
  expect(mocks.record).not.toHaveBeenCalled();
});
test("provider failures retain ownership", async () => {
  mocks.list.mockRejectedValueOnce(new Error("family is active"));
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "family is active"
  );
  expect(mocks.cleanup).not.toHaveBeenCalled();
  mocks.cleanup.mockRejectedValueOnce(new Error("delete failed"));
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "delete failed"
  );
  expect(mocks.record).not.toHaveBeenCalled();
});
test("changed provider scope cannot release a resource", async () => {
  mocks.createCleanupSession.mockReturnValue({
    create: vi.fn(),
    deleteAndConfirmAbsent: mocks.cleanup,
    scope: {
      providerId: "vercel",
      accountId: provider.accountId,
      scopeId: "another-project",
    },
  });
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "provider scope"
  );
  expect(mocks.cleanup).not.toHaveBeenCalled();
  expect(mocks.record).not.toHaveBeenCalled();
});
test("zero resources need no installed provider capability", async () => {
  mocks.capabilityInstalled = false;
  mocks.list.mockResolvedValue([]);
  await expect(
    purgeEveFamilyCodeSandboxes("owner", "root")
  ).resolves.toBeUndefined();
});
test("durable resources cannot be released without their provider capability", async () => {
  mocks.capabilityInstalled = false;
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "Select a sandbox provider"
  );
  expect(mocks.cleanup).not.toHaveBeenCalled();
  expect(mocks.record).not.toHaveBeenCalled();
});
