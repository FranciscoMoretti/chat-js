import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [{ userId: "owner", kind: "text", messageId: "message" }],
  saved: { createdAt: new Date("2020-01-01") },
  insert: vi.fn(),
  values: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "fixture-only" } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/file-storage", () => ({}));
vi.mock("@/lib/logger", () => ({ createModuleLogger: () => ({}) }));
vi.mock("@/lib/message-conversion", () => ({}));
vi.mock("@/lib/utils/message-mapping", () => ({}));
vi.mock("./client", () => {
  const tx = {
    select: () => ({
      from: () => ({ where: () => ({ orderBy: () => ({ for: state.lock }) }) }),
    }),
    insert: state.insert,
  };
  return {
    db: {
      ...tx,
      transaction: async (run: (db: typeof tx) => unknown) => await run(tx),
    },
  };
});

import { saveDocument, updateDocument } from "./queries";

const input = {
  id: "document",
  title: "Title",
  kind: "text",
  content: "body",
  userId: "owner",
  messageId: "message",
} satisfies Parameters<typeof saveDocument>[0];
beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [
    { userId: "owner", kind: "text", messageId: "original-message" },
  ];
  state.lock.mockImplementation(() => state.rows);
  state.insert.mockReturnValue({ values: state.values });
  state.values.mockReturnValue({ returning: () => [state.saved] });
});
it("owner edit returns persisted row and preserves original message for API edits", async () => {
  const { messageId: _, ...edit } = input;
  expect(await updateDocument(edit)).toEqual(state.saved);
  expect(state.lock).toHaveBeenCalledWith("update");
  expect(state.values).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "owner", messageId: "original-message" })
  );
});
it.each([
  [],
  [{ userId: "other", kind: "text", messageId: "message" }],
  [
    { userId: "owner", kind: "text", messageId: "message" },
    { userId: "other", kind: "text", messageId: "message" },
  ],
  [{ userId: "owner", kind: "code", messageId: "message" }],
])("denies missing, foreign, mixed-owner and mismatched-kind history", async (...rows) => {
  state.rows = rows;
  expect(await updateDocument(input)).toBeNull();
  expect(state.insert).not.toHaveBeenCalled();
});
it("missing owner is rejected before any write", async () => {
  expect(await updateDocument({ ...input, userId: "" })).toBeNull();
  await expect(saveDocument({ ...input, userId: "" })).rejects.toThrow(
    "Document owner required"
  );
  expect(state.insert).not.toHaveBeenCalled();
});
it("create returns inserted identity", async () => {
  expect(await saveDocument(input)).toEqual(state.saved);
});
