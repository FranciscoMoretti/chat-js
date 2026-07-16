import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createStore } from "zustand/vanilla";
import type { StoreState as BaseChatStoreState } from "@/lib/stores/base";
import type { ChatMessage } from "../ai/types";
import { type ThreadAugmentedState, withThreads } from "./with-threads";

function createMessage({
  id,
  role,
  createdAt,
  parentMessageId = null,
  parallelGroupId = null,
  parallelIndex = null,
  activeStreamId = null,
  text = "",
}: {
  id: string;
  role: ChatMessage["role"];
  createdAt: string;
  parentMessageId?: string | null;
  parallelGroupId?: string | null;
  parallelIndex?: number | null;
  activeStreamId?: string | null;
  text?: string;
}): ChatMessage {
  return {
    id,
    role,
    parts: text ? [{ type: "text", text }] : [],
    metadata: {
      createdAt: new Date(createdAt),
      parentMessageId,
      parallelGroupId,
      parallelIndex,
      isPrimaryParallel: parallelIndex === null ? null : parallelIndex === 0,
      selectedModel: "openai/gpt-4o-mini",
      activeStreamId,
      selectedTool: undefined,
    },
  };
}

function createThreadStore(initialMessages: ChatMessage[]) {
  return createStore<ThreadAugmentedState<ChatMessage>>()(
    withThreads<ChatMessage, BaseChatStoreState<ChatMessage>>(
      (set) =>
        ({
          _messageIndex: { update: () => undefined },
          _memoizedSelectors: new Map(),
          _throttledMessages: initialMessages,
          messages: initialMessages,
          setMessages: (messages: ChatMessage[]) => set({ messages }),
        }) as unknown as BaseChatStoreState<ChatMessage>
    )
  );
}

describe("withThreads", () => {
  it("preserves hidden branches when ThreadChat publishes an active-path snapshot", () => {
    const userA = createMessage({
      id: "user-a",
      role: "user",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const assistantA = createMessage({
      id: "assistant-a",
      role: "assistant",
      createdAt: "2024-01-01T00:00:01.000Z",
      parentMessageId: userA.id,
    });
    const userB = createMessage({
      id: "user-b",
      role: "user",
      createdAt: "2024-01-01T00:00:02.000Z",
    });
    const assistantB = createMessage({
      id: "assistant-b",
      role: "assistant",
      createdAt: "2024-01-01T00:00:03.000Z",
      parentMessageId: userB.id,
    });
    const store = createThreadStore([userB, assistantB]);

    store.getState().setAllMessages([userA, assistantA, userB, assistantB]);
    store.getState().setTreeSnapshot({
      childrenByParentId: {
        __root__: [userB.id],
        [userB.id]: [assistantB.id],
      },
      cursorId: assistantB.id,
      messagesById: {
        [userB.id]: userB,
        [assistantB.id]: assistantB,
      },
      parentById: {
        [userB.id]: null,
        [assistantB.id]: userB.id,
      },
      rootIds: [userB.id],
      version: 1,
    });

    const siblingInfo = store.getState().getMessageSiblingInfo(userB.id);
    assert.deepEqual(
      siblingInfo?.siblings.map((message) => message.id),
      [userA.id, userB.id]
    );
    const previousThread = store.getState().switchToSibling(userB.id, "prev");
    const previousThreadIds = [userA.id, assistantA.id];
    assert.deepEqual(
      previousThread?.map((message) => message.id),
      previousThreadIds
    );
    assert.deepEqual(
      store.getState().messages.map((message) => message.id),
      previousThreadIds
    );
    assert.deepEqual(
      store.getState()._throttledMessages?.map((message) => message.id),
      previousThreadIds
    );
  });

  it("preserves local-only optimistic branch nodes across server syncs", () => {
    const rootUser = createMessage({
      id: "user-root",
      role: "user",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const branchA = createMessage({
      id: "assistant-a",
      role: "assistant",
      createdAt: "2024-01-01T00:00:01.000Z",
      parentMessageId: rootUser.id,
      parallelGroupId: "group-root",
      parallelIndex: 0,
    });
    const branchB = createMessage({
      id: "assistant-b",
      role: "assistant",
      createdAt: "2024-01-01T00:00:02.000Z",
      parentMessageId: rootUser.id,
      parallelGroupId: "group-root",
      parallelIndex: 1,
    });
    const nestedUser = createMessage({
      id: "user-nested",
      role: "user",
      createdAt: "2024-01-01T00:00:03.000Z",
      parentMessageId: branchA.id,
    });
    const nestedBranchA = createMessage({
      id: "assistant-nested-a",
      role: "assistant",
      createdAt: "2024-01-01T00:00:04.000Z",
      parentMessageId: nestedUser.id,
      parallelGroupId: "group-nested",
      parallelIndex: 0,
      activeStreamId: "pending:assistant-nested-a",
    });
    const nestedBranchB = createMessage({
      id: "assistant-nested-b",
      role: "assistant",
      createdAt: "2024-01-01T00:00:05.000Z",
      parentMessageId: nestedUser.id,
      parallelGroupId: "group-nested",
      parallelIndex: 1,
      activeStreamId: "pending:assistant-nested-b",
    });

    const store = createThreadStore([
      rootUser,
      branchA,
      nestedUser,
      nestedBranchA,
    ]);

    store.getState().addMessageToTree(branchB);
    store.getState().addMessageToTree(nestedBranchB);

    store.getState().setMessagesWithEpoch([rootUser, branchB]);
    store.getState().setAllMessages([rootUser, branchA, branchB]);

    const allMessageIds = store
      .getState()
      .allMessages.map((message: ChatMessage) => message.id);
    assert.deepEqual(allMessageIds, [
      "user-root",
      "assistant-a",
      "user-nested",
      "assistant-nested-a",
      "assistant-b",
      "assistant-nested-b",
    ]);

    const restoredThread = store.getState().switchToMessage(branchA.id);
    assert.deepEqual(
      restoredThread?.map((message: ChatMessage) => message.id),
      ["user-root", "assistant-a", "user-nested", "assistant-nested-b"]
    );
    assert.equal(
      restoredThread?.at(-1)?.metadata.activeStreamId,
      "pending:assistant-nested-b"
    );
  });

  it("preserves a pending stream marker when a run inserts its assistant shell", () => {
    const rootUser = createMessage({
      id: "user-root",
      role: "user",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const assistant = createMessage({
      id: "assistant-a",
      role: "assistant",
      createdAt: "2024-01-01T00:00:01.000Z",
      parentMessageId: rootUser.id,
      activeStreamId: "pending:assistant-a",
    });
    const assistantWithoutMetadata = {
      id: assistant.id,
      parts: [],
      role: "assistant",
    } as unknown as ChatMessage;

    const store = createThreadStore([rootUser, assistant]);
    store.getState().addMessageToTree(assistantWithoutMetadata);

    const updatedAssistant = store.getState().allMessages.at(-1);
    assert.equal(
      updatedAssistant?.metadata.activeStreamId,
      "pending:assistant-a"
    );
    assert.equal(
      updatedAssistant?.metadata.selectedModel,
      assistant.metadata.selectedModel
    );
  });

  it("replaces a selected placeholder with completed server content when ready", () => {
    const rootUser = createMessage({
      id: "user-root",
      role: "user",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const placeholder = createMessage({
      id: "assistant-b",
      role: "assistant",
      createdAt: "2024-01-01T00:00:01.000Z",
      parentMessageId: rootUser.id,
      parallelGroupId: "group-root",
      parallelIndex: 1,
      activeStreamId: "pending:assistant-b",
    });
    const completed = createMessage({
      id: placeholder.id,
      role: "assistant",
      createdAt: "2024-01-01T00:00:01.000Z",
      parentMessageId: rootUser.id,
      parallelGroupId: "group-root",
      parallelIndex: 1,
      text: "Completed secondary response",
    });
    const store = createThreadStore([rootUser, placeholder]);

    store.getState().setAllMessages([rootUser, completed]);

    const completedPart = store.getState().messages.at(-1)?.parts.at(0);
    assert.equal(completedPart?.type, "text");
    assert.equal(
      completedPart?.type === "text" ? completedPart.text : null,
      "Completed secondary response"
    );
    assert.equal(
      store.getState().messages.at(-1)?.metadata.activeStreamId,
      null
    );
    const throttledPart = store
      .getState()
      ._throttledMessages?.at(-1)
      ?.parts.at(0);
    assert.equal(
      throttledPart?.type === "text" ? throttledPart.text : null,
      "Completed secondary response"
    );
  });

  it("fills metadata for ThreadChat assistant shells in tree snapshots", () => {
    const rootUser = createMessage({
      id: "user-root",
      role: "user",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const assistantWithoutMetadata = {
      id: "assistant-a",
      parts: [],
      role: "assistant",
    } as unknown as ChatMessage;

    const store = createThreadStore([rootUser]);

    store.getState().setTreeSnapshot({
      childrenByParentId: {
        __root__: [rootUser.id],
        [rootUser.id]: [assistantWithoutMetadata.id],
      },
      cursorId: assistantWithoutMetadata.id,
      messagesById: {
        [rootUser.id]: rootUser,
        [assistantWithoutMetadata.id]: assistantWithoutMetadata,
      },
      parentById: {
        [rootUser.id]: null,
        [assistantWithoutMetadata.id]: rootUser.id,
      },
      rootIds: [rootUser.id],
      version: 1,
    });

    const assistant = store.getState().messages.at(-1);
    assert.equal(assistant?.metadata.parentMessageId, rootUser.id);
    assert.equal(
      assistant?.metadata.selectedModel,
      rootUser.metadata.selectedModel
    );
  });

  it("adds exactly one user sibling when editing after branch navigation", () => {
    const userA = createMessage({
      id: "user-a",
      role: "user",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const assistantA = createMessage({
      id: "assistant-a",
      role: "assistant",
      createdAt: "2024-01-01T00:00:01.000Z",
      parentMessageId: userA.id,
    });
    const userB = createMessage({
      id: "user-b",
      role: "user",
      createdAt: "2024-01-01T00:00:02.000Z",
    });
    const assistantB = createMessage({
      id: "assistant-b",
      role: "assistant",
      createdAt: "2024-01-01T00:00:03.000Z",
      parentMessageId: userB.id,
    });
    const userC = createMessage({
      id: "user-c",
      role: "user",
      createdAt: "2024-01-01T00:00:04.000Z",
    });
    const assistantC = createMessage({
      id: "assistant-c",
      role: "assistant",
      createdAt: "2024-01-01T00:00:05.000Z",
      parentMessageId: userC.id,
    });

    const store = createThreadStore([userA, assistantA]);
    store.getState().addMessageToTree(userB);
    store.getState().addMessageToTree(assistantB);

    assert.equal(
      store.getState().getMessageSiblingInfo(userB.id)?.siblings.length,
      2
    );

    store.getState().switchToSibling(userB.id, "prev");
    store.getState().setMessages([]);
    store.getState().addMessageToTree(userC);
    store.getState().addMessageToTree(assistantC);

    const rootSiblingIds = store
      .getState()
      .getMessageSiblingInfo(userC.id)
      ?.siblings.map((message: ChatMessage) => message.id);

    assert.deepEqual(rootSiblingIds, [userA.id, userB.id, userC.id]);
  });
});
