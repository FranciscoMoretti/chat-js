import { beforeEach, expect, test, vi } from "vitest";

import type { SupportedLifecycleProvider } from "./lifecycle/provider";
import { prepareEveFamilyDeletion } from "./prepare-deletion";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  family: vi.fn(),
  prepare: vi.fn<SupportedLifecycleProvider["prepare"]>(),
  provider: vi.fn(),
  retire: vi.fn(),
}));
vi.mock("../env", () => ({
  env: { WORKFLOW_POSTGRES_URL: "postgresql://localhost/fixture" },
}));
vi.mock("./lifecycle/provider", () => ({
  createEveLifecycleProvider: mocks.provider,
}));
vi.mock("./retire-session", () => ({
  retireEveFamilyForDeletion: mocks.family,
  retireEveSessionForDeletion: mocks.retire,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.provider.mockReturnValue({
    check: mocks.check,
    prepare: mocks.prepare,
    supported: true,
  });
  mocks.family.mockResolvedValue({
    conversations: [
      { id: "root", sessionId: "session-root" },
      { id: "child", sessionId: "session-child" },
    ],
    rootId: "root",
  });
});

test("unsupported lifecycle cannot retire a family", async () => {
  mocks.provider.mockReturnValue({
    reason: "unverified erasure",
    supported: false,
  });
  await expect(prepareEveFamilyDeletion("owner", "child")).rejects.toThrow(
    "unverified erasure"
  );
  expect(mocks.family).not.toHaveBeenCalled();
  expect(mocks.prepare).not.toHaveBeenCalled();
});

test("failed compatibility preflight cannot retire a family", async () => {
  mocks.check.mockRejectedValueOnce(new Error("workflow fences missing"));
  await expect(prepareEveFamilyDeletion("owner", "child")).rejects.toThrow(
    "workflow fences missing"
  );
  expect(mocks.family).not.toHaveBeenCalled();
  expect(mocks.prepare).not.toHaveBeenCalled();
});

test("native preparation waits for family retirement and retains every member's inventory", async () => {
  const gate = Promise.withResolvers<boolean>();
  mocks.family.mockImplementationOnce(async () => {
    await gate.promise;
    return {
      conversations: [{ id: "root", sessionId: "session-root" }],
      rootId: "root",
    };
  });
  mocks.prepare.mockImplementationOnce(async (_sessionId, retire) => {
    await retire();
    return { runIds: ["root-run", "subagent-run"], streamIds: ["stream"] };
  });
  const preparation = prepareEveFamilyDeletion("owner", "root");
  await vi.waitFor(() => expect(mocks.family).toHaveBeenCalledOnce());
  expect(mocks.prepare).not.toHaveBeenCalled();
  gate.resolve(true);
  expect(await preparation).toMatchObject({
    nativeInventories: [
      {
        runIds: ["root-run", "subagent-run"],
        sessionId: "session-root",
        streamIds: ["stream"],
      },
    ],
    rootId: "root",
    runIds: ["root-run", "subagent-run"],
    streamIds: ["stream"],
  });
  expect(mocks.retire).toHaveBeenCalledWith("owner", "session-root");
});

test("partial preparation never returns a resource inventory and retry revisits the family", async () => {
  mocks.prepare
    .mockResolvedValueOnce({ runIds: ["root-run"], streamIds: ["shared"] })
    .mockRejectedValueOnce(new Error("child still active"));
  await expect(prepareEveFamilyDeletion("owner", "child")).rejects.toThrow(
    "child still active"
  );
  mocks.prepare.mockReset();
  mocks.prepare
    .mockResolvedValueOnce({ runIds: ["root-run"], streamIds: ["shared"] })
    .mockResolvedValueOnce({
      runIds: ["child-run"],
      streamIds: ["shared", "child"],
    });
  expect(await prepareEveFamilyDeletion("owner", "child")).toMatchObject({
    rootId: "root",
    runIds: ["child-run", "root-run"],
    streamIds: ["child", "shared"],
  });
  expect(mocks.prepare).toHaveBeenCalledWith(
    "session-root",
    expect.any(Function)
  );
  expect(mocks.prepare).toHaveBeenCalledWith(
    "session-child",
    expect.any(Function)
  );
});
