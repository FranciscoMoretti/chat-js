import { APIError } from "@vercel/sandbox";
import { beforeEach, expect, test, vi } from "vitest";
import { purgeEveFamilyCodeSandboxes } from "./purge-code-sandboxes";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  record: vi.fn(),
  get: vi.fn(),
  cleanup: vi.fn(),
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
vi.mock("../logger", () => ({ createModuleLogger: () => ({}) }));
const resource = {
  name: "owned",
  conversationId: "conversation",
  creationConfirmed: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue([resource]);
  mocks.record.mockResolvedValue(undefined);
  mocks.cleanup.mockResolvedValue(undefined);
});
const missing = () => new APIError(new Response(null, { status: 404 }));

test("cleans confirmed ownership by exact name without resuming and verifies absence", async () => {
  const sandbox = { name: "owned", persistent: false };
  mocks.get.mockResolvedValueOnce(sandbox).mockRejectedValueOnce(missing());
  await purgeEveFamilyCodeSandboxes("owner", "root");
  expect(mocks.get).toHaveBeenCalledWith(
    expect.objectContaining({ name: "owned", resume: false })
  );
  expect(mocks.cleanup).toHaveBeenCalledWith(
    sandbox,
    expect.anything(),
    "owned"
  );
  expect(mocks.record).toHaveBeenCalledWith("owner", "conversation", "owned");
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
    { name: "owned", persistent: true },
  ]) {
    mocks.get.mockResolvedValueOnce(sandbox);
    await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
      "needs reconciliation"
    );
  }
  expect(mocks.cleanup).not.toHaveBeenCalled();
  mocks.get.mockResolvedValue({ name: "owned", persistent: false });
  mocks.cleanup.mockRejectedValueOnce(new Error("delete failed"));
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "delete failed"
  );
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "remains available"
  );
  expect(mocks.record).not.toHaveBeenCalled();
});
