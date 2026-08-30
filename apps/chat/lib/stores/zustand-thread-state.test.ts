import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { ApplicationThread } from "@/lib/application-thread";
import { createCustomChatStore } from "./custom-store-provider";
import { ZustandThreadState } from "./zustand-thread-state";

const initialMessage: UIMessage = {
  id: "user-1",
  parts: [{ text: "Hello", type: "text" }],
  role: "user",
};

function chatMessage(
  id: string,
  text: string,
  role: "assistant" | "user" = "user"
): ChatMessage {
  return {
    id,
    metadata: {
      activeStreamId: null,
      createdAt: new Date(0),
      parentMessageId: null,
      selectedModel: "openai/gpt-5-nano",
    },
    parts: [{ text, type: "text" }],
    role,
  };
}

describe("ZustandThreadState", () => {
  it("commits one synchronous atomic thread update", () => {
    const store = createCustomChatStore<UIMessage>([initialMessage]);
    const state = new ZustandThreadState(store);
    let updaterCalls = 0;
    let notifications = 0;
    const unsubscribe = state.subscribe(() => {
      notifications += 1;
      expect(store.getState().messages).toBe(state.getSnapshot().messages);
      expect(store.getState().status).toBe(state.getSnapshot().status);
    });

    state.update((snapshot) => {
      updaterCalls += 1;
      return {
        ...snapshot,
        cursorId: null,
        messages: [],
      };
    });

    expect(updaterCalls).toBe(1);
    expect(notifications).toBe(1);
    expect(state.getSnapshot().cursorId).toBeNull();
    expect(store.getState().messages).toEqual([]);
    unsubscribe();
  });

  it("does not notify thread subscribers for unrelated store updates", () => {
    const store = createCustomChatStore<UIMessage>([initialMessage]);
    const state = new ZustandThreadState(store);
    let notifications = 0;
    const unsubscribe = state.subscribe(() => {
      notifications += 1;
    });

    store.getState().setId("chat-1");

    expect(notifications).toBe(0);
    unsubscribe();
  });

  it("indexes parallel runs by response group and clears them on reset", () => {
    const store = createCustomChatStore<UIMessage>([initialMessage]);

    store.getState().registerParallelRun({
      parallelGroupId: "group-1",
      parallelIndex: 1,
      runId: "run-2",
    });

    expect(store.getState().parallelRunIdsByGroup).toEqual({
      "group-1": { 1: "run-2" },
    });

    store.getState().reset();
    expect(store.getState().parallelRunIdsByGroup).toEqual({});
  });

  it("propagates updater errors without committing", () => {
    const store = createCustomChatStore<UIMessage>([initialMessage]);
    const state = new ZustandThreadState(store);
    const before = state.getSnapshot();

    expect(() =>
      state.update(() => {
        throw new Error("failed update");
      })
    ).toThrow("failed update");
    expect(state.getSnapshot()).toBe(before);
  });

  it("makes controller mutations canonical in the Zustand store", () => {
    const root = chatMessage("root", "Root");
    const firstBranch = chatMessage("branch-1", "First branch", "assistant");
    const secondBranch = chatMessage("branch-2", "Second branch", "assistant");
    const store = createCustomChatStore<ChatMessage>([root]);
    const thread = new ApplicationThread({
      id: "chat-1",
      state: new ZustandThreadState(store),
    });

    thread.addMessage(firstBranch, root.id);
    thread.addMessage(secondBranch, root.id);
    thread.setCursor(firstBranch.id);

    expect(store.getState().messages).toEqual([root, firstBranch]);

    thread.setCursor(secondBranch.id);

    const selectedSnapshot = store.getState().threadSnapshot;
    expect(selectedSnapshot.messages).toEqual([root, secondBranch]);
    expect(selectedSnapshot.childrenByParentId[root.id]).toEqual([
      firstBranch.id,
      secondBranch.id,
    ]);
    expect(store.getState().messages).toBe(selectedSnapshot.messages);
    expect(thread.getSnapshot()).toBe(selectedSnapshot);
  });

  it("initializes the store from the tree's selected path", () => {
    const staleMessage = chatMessage("stale", "Stale");
    const root = chatMessage("root", "Root");
    const branch = chatMessage("branch", "Branch", "assistant");
    const store = createCustomChatStore<ChatMessage>([staleMessage], {
      initialTree: {
        cursorId: branch.id,
        nodes: [
          { message: root, parentId: null },
          { message: branch, parentId: root.id },
        ],
        version: 1,
      },
    });

    expect(store.getState().messages).toEqual([root, branch]);
    expect(store.getState()._throttledMessages).toEqual([root, branch]);
    expect(store.getState().threadSnapshot.messages).toBe(
      store.getState().messages
    );
  });
});
