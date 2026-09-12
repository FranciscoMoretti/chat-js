import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCodeDocumentTool } from "./create-code-document";
import { createSheetDocumentTool } from "./create-sheet-document";
import { createTextDocumentTool } from "./create-text-document";
import { editCodeDocumentTool } from "./edit-code-document";
import { editSheetDocumentTool } from "./edit-sheet-document";
import { editTextDocumentTool } from "./edit-text-document";

const queries = vi.hoisted(() => ({
  saveDocument: vi.fn(),
  updateDocument: vi.fn(),
}));
vi.mock("@/lib/db/queries", () => queries);
vi.mock("@/lib/utils", () => ({ generateUUID: () => "new-document" }));
const factories = [
  createTextDocumentTool,
  createCodeDocumentTool,
  createSheetDocumentTool,
  editTextDocumentTool,
  editCodeDocumentTool,
  editSheetDocumentTool,
];
const savedAt = new Date("2020-01-02T03:04:05.000Z");
beforeEach(() => {
  vi.resetAllMocks();
  queries.saveDocument.mockResolvedValue({ createdAt: savedAt });
  queries.updateDocument.mockResolvedValue({ createdAt: savedAt });
});
describe.each(factories)("document tool %s", (factory) => {
  const execute = (user = true) => {
    const tool = factory({
      session: user ? { user: { id: "owner" } } : {},
      messageId: "message",
      selectedModel: "openai/gpt-4.1",
    });
    if (!tool.execute) {
      throw new Error("Missing execute");
    }
    return tool.execute(
      { title: "Title", content: "body", documentId: "existing" },
      { toolCallId: "call", messages: [], context: {} }
    );
  };
  it("returns persisted identity", async () => {
    expect(await execute()).toMatchObject({
      status: "success",
      date: savedAt.toISOString(),
    });
  });
  it("rejects missing caller without saving", async () => {
    expect(await execute(false)).toMatchObject({ status: "error" });
    expect(queries.saveDocument).not.toHaveBeenCalled();
    expect(queries.updateDocument).not.toHaveBeenCalled();
  });
  it("propagates save failure", async () => {
    queries.saveDocument.mockRejectedValue(new Error("save failed"));
    queries.updateDocument.mockRejectedValue(new Error("save failed"));
    await expect(execute()).rejects.toThrow("save failed");
  });
});
it.each([
  editTextDocumentTool,
  editCodeDocumentTool,
  editSheetDocumentTool,
])("rejects inaccessible edits", async (factory) => {
  queries.updateDocument.mockResolvedValue(null);
  const tool = factory({
    session: { user: { id: "other" } },
    messageId: "message",
    selectedModel: "openai/gpt-4.1",
  });
  if (!tool.execute) {
    throw new Error("Missing execute");
  }
  expect(
    await tool.execute(
      { title: "Title", content: "body", documentId: "foreign" },
      { toolCallId: "call", messages: [], context: {} }
    )
  ).toEqual({ status: "error", error: "Document not found" });
  expect(queries.updateDocument).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "other", id: "foreign" })
  );
});
