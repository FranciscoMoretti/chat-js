import { beforeEach, expect, test, vi } from "vitest";
import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { import_file, publish_file } from "@/chatjs/tools/publish-file/tool";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  publish: vi.fn(),
  uploader: vi.fn(),
  access: vi.fn(),
  import: vi.fn(),
}));
vi.mock("../db/eve-files", () => ({ withEveConversationFile: mocks.access }));
vi.mock("../file-storage", () => ({
  downloadFile: vi.fn(),
  getFileMetadata: vi.fn(),
}));
vi.mock("@/chatjs/tools/publish-file/import", () => ({
  importStoredFile: mocks.import,
}));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));
vi.mock("./generated-files", () => ({
  eveGeneratedFileUploader: mocks.uploader,
}));
vi.mock("@/chatjs/tools/publish-file/publish", () => ({
  publishSandboxFile: mocks.publish,
}));

const owner = {
  attributes: {},
  authenticator: "chatjs-gateway",
  principalId: "owner",
  principalType: "user" as const,
};
const contextFor = (current: typeof owner | null = owner) =>
  testToolContext({
    session: {
      id: "native-session",
      turn: { id: "turn", sequence: 1 },
      auth: { initiator: owner, current },
    },
  });
beforeEach(() => {
  vi.resetAllMocks();
});

test.each([
  null,
  { ...owner, principalId: "stranger" },
  { ...owner, authenticator: "slack-webhook" },
])(
  "publication rejects a caller without the owner's authority",
  async (current) => {
    await expect(
      publish_file.execute({ path: "report.csv" }, contextFor(current))
    ).rejects.toThrow("authority");
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  }
);

test("publication checks the conversation boundary before acquiring the sandbox", async () => {
  mocks.resolve.mockRejectedValue(new Error("Conversation deleted"));
  await expect(
    publish_file.execute({ path: "report.csv" }, contextFor())
  ).rejects.toThrow("Conversation deleted");
  expect(mocks.resolve).toHaveBeenCalledWith(
    "owner",
    "native-session",
    expect.any(AbortSignal)
  );
  expect(mocks.uploader).not.toHaveBeenCalled();
  expect(mocks.publish).not.toHaveBeenCalled();
});

const imported = { fileId: "abcdefghijklmnopqrstuvwx", name: "budget.xlsx" };
test.each([
  null,
  { ...owner, principalId: "stranger" },
  { ...owner, authenticator: "slack-webhook" },
])(
  "file import rejects callers without the current owner's authority",
  async (current) => {
    await expect(
      import_file.execute(imported, contextFor(current))
    ).rejects.toThrow("authority");
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.import).not.toHaveBeenCalled();
  }
);

test("file import checks the current conversation reference before reading storage or acquiring a sandbox", async () => {
  mocks.resolve.mockResolvedValue({
    ownerId: "owner",
    conversationId: "conversation",
  });
  mocks.access.mockRejectedValue(
    new Error("File unavailable in this conversation")
  );
  await expect(import_file.execute(imported, contextFor())).rejects.toThrow(
    "unavailable"
  );
  expect(mocks.access).toHaveBeenCalledWith(
    "owner",
    "conversation",
    imported.fileId,
    expect.any(Function)
  );
  expect(mocks.import).not.toHaveBeenCalled();
});

test("file import copies an authorized artifact without requiring its original sandbox", async () => {
  mocks.resolve.mockResolvedValue({
    ownerId: "owner",
    conversationId: "conversation",
  });
  mocks.access.mockImplementation(
    async (_owner, _conversation, _key, access: () => Promise<unknown>) =>
      await access()
  );
  mocks.import.mockResolvedValue({
    ...imported,
    path: "/workspace/new-copy.xlsx",
    size: 12,
    mediaType: "application/octet-stream",
  });
  await expect(
    import_file.execute(imported, contextFor())
  ).resolves.toMatchObject({ path: "/workspace/new-copy.xlsx" });
  expect(mocks.import).toHaveBeenCalledWith(imported, expect.anything());
  expect(mocks.publish).not.toHaveBeenCalled();
});
