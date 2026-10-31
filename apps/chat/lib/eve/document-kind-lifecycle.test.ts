import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { composeDocuments } from "@/chatjs/core/documents/document-definition";
import { executeEveDocumentTool } from "./document-tools";
import { saveManualEveDocument } from "./save-document";
import { testToolContext } from "../../tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  scope: vi.fn(),
  conversation: vi.fn(),
  installed: true,
}));
vi.mock("@/lib/db/eve-documents", () => ({
  getEveDocumentRevision: mocks.read,
  saveEveDocumentRevision: mocks.save,
}));
vi.mock("@/lib/db/eve-queries", () => ({
  getEveConversation: mocks.conversation,
}));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.scope,
}));
const current = () =>
  composeDocuments(
    mocks.installed
      ? [
          {
            kind: "diagram",
            contentSchema: z.string().startsWith("graph "),
            createTool: "drawDiagram",
            editTool: "reviseDiagram",
          },
        ]
      : []
  );
vi.mock("@/integrations/documents/definitions", () => ({
  documentDefinitions: {
    get kinds() {
      return current().kinds;
    },
    get operations() {
      return current().operations;
    },
    find: (kind: string) => current().find(kind),
    require: (kind: string) => current().require(kind),
  },
}));
const documentId = "60dbe86a-b2c4-4d32-ae09-a00e90b84e99";
const revisionId = "663ccf42-10c9-453f-b9da-ebf684a6da97";
const conversationId = "633ccf42-10c9-453f-b9da-ebf684a6da97";
const revision = {
  documentId,
  id: revisionId,
  kind: "diagram",
  title: "Flow",
  content: "graph A --> B",
  fileIds: [],
  createdAt: new Date("2026-01-01"),
};
const context = testToolContext({
  abortSignal: new AbortController().signal,
  callId: "draw",
  session: {
    id: "session",
    auth: {
      current: null,
      initiator: {
        principalId: "owner",
        principalType: "user",
        authenticator: "test",
        attributes: {},
      },
    },
    turn: { id: "turn", sequence: 1 },
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.installed = true;
  mocks.scope.mockResolvedValue({ ownerId: "owner", conversationId });
  mocks.conversation.mockResolvedValue({
    id: conversationId,
    sessionId: "session",
    state: "bound",
  });
  mocks.read.mockResolvedValue(revision);
  mocks.save.mockResolvedValue(revision);
});
it("validates installed custom writes before persistence", async () => {
  await expect(
    executeEveDocumentTool(
      "drawDiagram",
      { title: "Flow", content: "invalid", fileIds: [] },
      context
    )
  ).rejects.toThrow();
  expect(mocks.save).not.toHaveBeenCalled();
  await executeEveDocumentTool(
    "drawDiagram",
    { title: "Flow", content: "graph A --> B", fileIds: [] },
    context
  );
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "diagram",
      ownerId: "owner",
      conversationId,
    }),
    context.abortSignal
  );
});
it("preserves authorized reads after removal, blocks writes, and restores editing on reinstall", async () => {
  mocks.installed = false;
  await expect(
    executeEveDocumentTool("readDocument", { documentId }, context)
  ).resolves.toMatchObject({ kind: "diagram", content: revision.content });
  expect(mocks.read).toHaveBeenCalledWith("owner", conversationId, documentId);
  await expect(
    executeEveDocumentTool(
      "drawDiagram",
      { title: "Flow", content: revision.content },
      context
    )
  ).rejects.toThrow("unavailable");
  const input = {
    documentId,
    expectedRevisionId: revisionId,
    conversationId,
    operationId: "733ccf42-10c9-453f-b9da-ebf684a6da97",
    title: "Flow",
    content: revision.content,
  };
  await expect(saveManualEveDocument("owner", input)).rejects.toThrow();
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.installed = true;
  await expect(saveManualEveDocument("owner", input)).resolves.toMatchObject({
    kind: "diagram",
  });
});
it("never turns missing authorization into a retained-document read", async () => {
  mocks.installed = false;
  mocks.read.mockResolvedValue(null);
  await expect(
    executeEveDocumentTool("readDocument", { documentId }, context)
  ).rejects.toThrow("not found");
});
