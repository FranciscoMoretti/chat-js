import assert from "node:assert/strict";

import { describe, it, vi } from "vitest";

import { gatewayModelDefaults } from "@/lib/ai/gateway-model-defaults";

import type { ChatMessage } from "./ai/types";
import {
  cloneAttachmentsInMessages,
  cloneMessagesWithDocuments,
} from "./clone-messages";

const fileStorage = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "test" },
}));

vi.mock("./file-storage", () => fileStorage);

function createMessage({
  id,
  parentMessageId = null,
  chatId,
}: {
  id: string;
  parentMessageId?: string | null;
  chatId: string;
}): ChatMessage & { chatId: string } {
  return {
    chatId,
    id,
    metadata: {
      activeStreamId: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      parentMessageId,
      selectedModel: gatewayModelDefaults.workflows.chat,
    },
    parts: [],
    role: "user",
  };
}

describe("cloneMessagesWithDocuments", () => {
  it("clones message ids, chatId and parentMessageId thread structure", () => {
    const sourceChatId = "source-chat";
    const newChatId = "new-chat";
    const userId = "user-1";

    const m1 = createMessage({
      chatId: sourceChatId,
      id: "m1",
      parentMessageId: null,
    });
    const m2 = createMessage({
      chatId: sourceChatId,
      id: "m2",
      parentMessageId: "m1",
    });
    const m3 = createMessage({
      chatId: sourceChatId,
      id: "m3",
      parentMessageId: "m2",
    });

    const { clonedMessages, messageIdMap } = cloneMessagesWithDocuments(
      [m1, m2, m3],
      [],
      newChatId,
      userId
    );

    assert.equal(clonedMessages.length, 3);

    // IDs should all be new and unique
    const newIds = clonedMessages.map((m) => m.id);
    assert.equal(new Set(newIds).size, 3);
    assert.ok(!newIds.includes("m1"));
    assert.ok(!newIds.includes("m2"));
    assert.ok(!newIds.includes("m3"));

    // All messages should belong to the new chat
    for (const msg of clonedMessages) {
      assert.equal(msg.chatId, newChatId);
    }

    const newM1Id = messageIdMap.get("m1");
    const newM2Id = messageIdMap.get("m2");
    const newM3Id = messageIdMap.get("m3");

    assert.ok(newM1Id);
    assert.ok(newM2Id);
    assert.ok(newM3Id);

    const clonedM1 = clonedMessages.find((m) => m.id === newM1Id);
    const clonedM2 = clonedMessages.find((m) => m.id === newM2Id);
    const clonedM3 = clonedMessages.find((m) => m.id === newM3Id);

    assert.ok(clonedM1);
    assert.ok(clonedM2);
    assert.ok(clonedM3);

    // Root has no parent
    assert.equal(clonedM1.metadata.parentMessageId, null);

    // Second-level message should point to cloned root
    assert.equal(clonedM2.metadata.parentMessageId, newM1Id);

    // Third-level message should point to cloned second-level
    assert.equal(clonedM3.metadata.parentMessageId, newM2Id);
  });

  it("clones documents and updates document references in message parts", () => {
    const sourceChatId = "source-chat";
    const newChatId = "new-chat";
    const userId = "user-1";

    const messageWithDoc = createMessage({
      chatId: sourceChatId,
      id: "m-doc",
      parentMessageId: null,
    });

    // Minimal tool parts that reference a document id.
    // Shapes match the actual tool output types so the test type-checks.
    messageWithDoc.parts = [
      {
        input: {
          content: "The document content",
          title: "Doc title",
        },
        output: {
          date: "2024-01-01T00:00:00.000Z",
          documentId: "doc-1",
          result: "A document was created and is now visible to the user.",
          status: "success",
        },
        state: "output-available",
        toolCallId: "call-create",
        type: "tool-createTextDocument",
      },
      {
        input: {
          content: "Updated content",
          documentId: "doc-1",
          title: "Doc title",
        },
        output: {
          date: "2024-01-01T00:00:00.000Z",
          documentId: "doc-1",
          result: "The document was updated and is now visible to the user.",
          status: "success",
        },
        state: "output-available",
        toolCallId: "call-update",
        type: "tool-editTextDocument",
      },
      {
        input: {},
        output: {
          date: "2024-01-01T00:00:00.000Z",
          documentId: "doc-1",
          format: "report",
          result: "Deep research report content",
          status: "success",
        },
        state: "output-available",
        toolCallId: "call-deep",
        type: "tool-deepResearch",
      },
    ];

    const sourceDocuments = [
      {
        content: "hello",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        id: "doc-1",
        kind: "text",
        messageId: "m-doc",
        title: "Doc title",
        userId: "source-user",
      },
    ];

    const { clonedMessages, clonedDocuments, messageIdMap, documentIdMap } =
      cloneMessagesWithDocuments(
        [messageWithDoc],
        sourceDocuments,
        newChatId,
        userId
      );

    assert.equal(clonedMessages.length, 1);
    assert.equal(clonedDocuments.length, 1);

    const newMessageId = messageIdMap.get("m-doc");
    const newDocumentId = documentIdMap.get("doc-1");

    assert.ok(newMessageId);
    assert.ok(newDocumentId);

    const [clonedMessage] = clonedMessages;
    const [clonedDocument] = clonedDocuments;

    // Document should point to cloned message and new user
    assert.equal(clonedDocument.messageId, newMessageId);
    assert.equal(clonedDocument.userId, userId);
    assert.equal(clonedDocument.id, newDocumentId);

    // All tool parts in the cloned message should reference the new document id
    for (const part of clonedMessage.parts) {
      if (
        (part.type === "tool-createTextDocument" ||
          part.type === "tool-createCodeDocument" ||
          part.type === "tool-createSheetDocument" ||
          part.type === "tool-editTextDocument" ||
          part.type === "tool-editCodeDocument" ||
          part.type === "tool-editSheetDocument" ||
          part.type === "tool-deepResearch") &&
        part.state === "output-available" &&
        part.output &&
        "documentId" in part.output
      ) {
        assert.equal(part.output.documentId, newDocumentId);
      }
    }
  });
});

describe("cloneAttachmentsInMessages", () => {
  it("copies managed files through the configured storage provider", async () => {
    fileStorage.downloadFile.mockResolvedValue({
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode("contents").buffer),
      type: "text/plain",
    });
    fileStorage.uploadFile.mockResolvedValue({
      url: "https://chat.example/api/files/content?key=cloned-key",
    });

    const [message] = await cloneAttachmentsInMessages([
      {
        parts: [
          {
            filename: "attachment.txt",
            mediaType: "text/plain",
            type: "file",
            url: "https://old-chat.example/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png",
          },
        ],
      },
    ]);

    assert.deepEqual(fileStorage.downloadFile.mock.calls, [
      ["l_u0a2bkphKLFKsBI4q5Tue9.png"],
    ]);
    assert.equal(fileStorage.uploadFile.mock.calls[0]?.[0], "attachment.txt");
    assert.equal(fileStorage.uploadFile.mock.calls[0]?.[2], "text/plain");
    assert.equal(
      message.parts[0]?.type === "file" ? message.parts[0].url : null,
      "https://chat.example/api/files/content?key=cloned-key"
    );
  });
});
