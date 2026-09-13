import { APIError } from "@vercel/sandbox";
import { beforeEach, expect, test, vi } from "vitest";

import { eveCodeSandboxName } from "./code-sandbox-name";
import { purgeEveFamilyCodeSandboxes } from "./purge-code-sandboxes";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  record: vi.fn(),
  get: vi.fn(),
  cleanup: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@vercel/sandbox", async (original) => ({
  ...(await original<typeof import("@vercel/sandbox")>()),
  Sandbox: { get: mocks.get },
}));
vi.mock("../db/eve-code-sandboxes", () => ({
  listEveCodeSandboxesForDeletion: mocks.list,
  recordEveCodeSandboxDeletion: mocks.record,
}));
vi.mock("../../tools/platform/code-execution.shared", () => ({
  cleanupSandbox: mocks.cleanup,
  getTokenAuth: () => ({}),
}));
vi.mock("../../tools/platform/sandbox-auth", () => ({
  resolveSandboxAuth: mocks.auth,
}));
vi.mock("../logger", () => ({ createModuleLogger: () => ({}) }));
const auth = { teamId: "team", projectId: "project", token: "token" };
const name = eveCodeSandboxName({
  ownerId: "owner",
  sessionId: "session",
  callId: "call",
  provider: auth,
});
const resource = {
  name,
  sessionId: "session",
  callId: "call",
  conversationId: "conversation",
  creationConfirmed: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(auth);
  mocks.list.mockResolvedValue([resource]);
  mocks.record.mockResolvedValue(undefined);
  mocks.cleanup.mockResolvedValue(undefined);
});
const missing = () => new APIError(new Response(null, { status: 404 }));

test("cleans confirmed ownership by exact name without resuming and verifies absence", async () => {
  const sandbox = { name, persistent: false };
  mocks.get.mockResolvedValueOnce(sandbox).mockRejectedValueOnce(missing());
  await purgeEveFamilyCodeSandboxes("owner", "root");
  expect(mocks.get).toHaveBeenCalledWith(
    expect.objectContaining({ name, resume: false })
  );
  expect(mocks.cleanup).toHaveBeenCalledWith(sandbox, expect.anything(), name);
  expect(mocks.record).toHaveBeenCalledWith("owner", "conversation", name);
});

test("a retry accepts an already absent confirmed allocation", async () => {
  mocks.get.mockRejectedValue(missing());
  await purgeEveFamilyCodeSandboxes("owner", "root");
  expect(mocks.cleanup).not.toHaveBeenCalled();
  expect(mocks.record).toHaveBeenCalledOnce();
});

test("unknown creation never uses absence to declare deletion complete", async () => {
  mocks.list.mockResolvedValue([{ ...resource, creationConfirmed: false }]);
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "uncertain code sandbox creation"
  );
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.record).not.toHaveBeenCalled();
});

test("authorization and provider failures retain ownership", async () => {
  mocks.list.mockRejectedValueOnce(new Error("family is active"));
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "family is active"
  );
  expect(mocks.get).not.toHaveBeenCalled();
  mocks.get.mockRejectedValue(
    new APIError(new Response(null, { status: 503 }))
  );
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow();
  expect(mocks.record).not.toHaveBeenCalled();
});

test("mismatched identity, persistence, and cleanup failure cannot release a record", async () => {
  for (const sandbox of [
    { name: "foreign", persistent: false },
    { name, persistent: true },
  ]) {
    mocks.get.mockResolvedValueOnce(sandbox);
    await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
      "needs reconciliation"
    );
  }
  expect(mocks.cleanup).not.toHaveBeenCalled();
  mocks.get.mockResolvedValue({ name, persistent: false });
  mocks.cleanup.mockRejectedValueOnce(new Error("delete failed"));
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "delete failed"
  );
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "remains available"
  );
  expect(mocks.record).not.toHaveBeenCalled();
});

test("changed provider scope cannot use absence to release a resource", async () => {
  mocks.auth.mockResolvedValue({ ...auth, projectId: "another-project" });
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "provider scope"
  );
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.cleanup).not.toHaveBeenCalled();
  expect(mocks.record).not.toHaveBeenCalled();
});
