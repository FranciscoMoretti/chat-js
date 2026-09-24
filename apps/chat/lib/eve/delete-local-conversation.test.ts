import { beforeEach, expect, test, vi } from "vitest";

import { deleteLocalEveConversationFamily } from "./delete-local-conversation";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  native: vi.fn(),
  resources: vi.fn(),
  retire: vi.fn(),
}));
vi.mock("../env", () => ({
  env: { WORKFLOW_POSTGRES_URL: "postgresql://localhost/fixture" },
}));
vi.mock("../db/eve-deletion", () => ({
  completeEveConversationDeletion: mocks.complete,
}));
vi.mock("../db/eve-native-purge", () => ({
  purgeEveNativeSession: mocks.native,
}));
vi.mock("./purge-local-resources", () => ({
  purgeLocalEveFamilyResources: mocks.resources,
}));
vi.mock("./retire-session", () => ({
  retireEveSessionForDeletion: mocks.retire,
}));
const family = {
  conversations: [
    { id: "root", sessionId: "session-root" },
    { id: "branch", sessionId: "session-branch" },
  ],
  rootId: "root",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resources.mockResolvedValue(family);
  mocks.native.mockResolvedValue(undefined);
  mocks.complete.mockResolvedValue(undefined);
});

test("all resources and native family payloads finish before the application tombstone", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.native.mockImplementationOnce(async (_url, _scope, retire) => {
    await retire();
  });
  mocks.native.mockReturnValueOnce(gate.promise);
  const deletion = deleteLocalEveConversationFamily(
    "owner",
    "branch",
    "/trusted/app"
  );
  await vi.waitFor(() => expect(mocks.native).toHaveBeenCalledTimes(2));
  expect(mocks.resources).toHaveBeenCalledWith(
    "owner",
    "branch",
    "/trusted/app"
  );
  expect(mocks.retire).toHaveBeenCalledWith("owner", "session-root");
  expect(mocks.native.mock.calls.map((call) => call[1].sessionId)).toEqual([
    "session-root",
    "session-branch",
  ]);
  expect(mocks.complete).not.toHaveBeenCalled();
  gate.resolve(undefined);
  expect(await deletion).toEqual({ rootId: "root" });
  expect(mocks.complete).toHaveBeenCalledWith("owner", "root");
});

test("resource uncertainty prevents any native payload erasure", async () => {
  mocks.resources.mockRejectedValue(new Error("uncertain allocation"));
  await expect(
    deleteLocalEveConversationFamily("owner", "root", "/app")
  ).rejects.toThrow("uncertain allocation");
  expect(mocks.native).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
});

test("partial native purge retains pending state and retry runs the full ordering again", async () => {
  mocks.native
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("branch unavailable"));
  await expect(
    deleteLocalEveConversationFamily("owner", "root", "/app")
  ).rejects.toThrow("branch unavailable");
  expect(mocks.complete).not.toHaveBeenCalled();
  expect(
    await deleteLocalEveConversationFamily("owner", "root", "/app")
  ).toEqual({ rootId: "root" });
  expect(mocks.resources).toHaveBeenCalledTimes(2);
  expect(mocks.native.mock.calls.map((call) => call[1].sessionId)).toEqual([
    "session-root",
    "session-branch",
    "session-root",
    "session-branch",
  ]);
});

test("foreign or missing families cannot erase native or application data", async () => {
  mocks.resources.mockResolvedValue(undefined);
  expect(
    await deleteLocalEveConversationFamily("foreign", "root", "/app")
  ).toBeUndefined();
  expect(mocks.native).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
});

test("an already deleted family is idempotent without resetting native sessions", async () => {
  mocks.resources.mockResolvedValue({ conversations: [], rootId: "root" });
  expect(
    await deleteLocalEveConversationFamily("owner", "root", "/app")
  ).toEqual({ rootId: "root" });
  expect(mocks.native).not.toHaveBeenCalled();
  expect(mocks.retire).not.toHaveBeenCalled();
});
