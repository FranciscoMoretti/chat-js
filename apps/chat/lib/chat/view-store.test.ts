import { Thread } from "@chat-js/thread";
import type { ChatTransport, UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { createArtifactOrigin } from "./artifact-origin";
import { createConversationView, getConversationView } from "./view-store";

class ControlledTransport implements ChatTransport<ChatMessage> {
  requests: {
    controller: ReadableStreamDefaultController<UIMessageChunk>;
    options: Parameters<ChatTransport<ChatMessage>["sendMessages"]>[0];
  }[] = [];
  sendMessages: ChatTransport<ChatMessage>["sendMessages"] = (options) =>
    Promise.resolve(
      new ReadableStream({
        start: (controller) => {
          this.requests.push({ controller, options });
          options.abortSignal?.addEventListener(
            "abort",
            () => {
              controller.enqueue({ type: "abort" });
              controller.close();
            },
            { once: true }
          );
        },
      })
    );
  reconnectToStream: ChatTransport<ChatMessage>["reconnectToStream"] = () =>
    Promise.resolve(null);
  finish(index: number, id: string) {
    const { controller } = this.requests[index];
    controller.enqueue({ type: "start", messageId: id });
    controller.enqueue({ type: "text-start", id: "text" });
    controller.enqueue({ type: "text-delta", id: "text", delta: id });
    controller.enqueue({ type: "text-end", id: "text" });
    controller.close();
  }
}
function user(id: string): ChatMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text: id }],
    metadata: {
      selectedModel: "openai/gpt-4o-mini",
      createdAt: new Date(),
      parentMessageId: null,
      activeStreamId: null,
    },
  };
}
function fixture() {
  const transport = new ControlledTransport();
  const thread = new Thread<ChatMessage>({
    transport,
    messages: [user("root")],
  });
  const a = createConversationView({ id: "a", thread });
  const b = createConversationView({ id: "b", thread });
  const disconnectA = a.connect();
  const disconnectB = b.connect();
  return { thread, transport, a, b, disconnectA, disconnectB };
}
describe("independent conversation views", () => {
  it("follows only its own run, including the submitted user before tokens arrive", async () => {
    const { thread, transport, a, b, disconnectA, disconnectB } = fixture();
    const runA = await a.startRun({ message: user("user-a") });
    const runB = await b.startRun({ message: user("user-b") });
    expect(a.getMessages().map((m) => m.id)).toEqual(["root", "user-a"]);
    expect(b.getMessages().map((m) => m.id)).toEqual(["root", "user-b"]);
    expect(thread.getSnapshot().cursorId).toBe("root");
    transport.finish(1, "answer-b");
    await runB.finished;
    transport.finish(0, "answer-a");
    await runA.finished;
    expect(a.getMessages().map((m) => m.id)).toEqual([
      "root",
      "user-a",
      "answer-a",
    ]);
    expect(b.getMessages().map((m) => m.id)).toEqual([
      "root",
      "user-b",
      "answer-b",
    ]);
    disconnectA();
    disconnectB();
  });
  it("does not follow a delayed send after navigating away and back", async () => {
    const { transport, a, disconnectA, disconnectB } = fixture();
    const pending = a.startRun({ message: user("late") });
    a.select(null);
    a.select("root");
    const run = await pending;
    transport.finish(0, "late-answer");
    await run.finished;
    expect(a.store.getState().cursorId).toBe("root");
    disconnectA();
    disconnectB();
  });
  it("keeps execution alive when its view disconnects and stops only the other selected run", async () => {
    const { thread, transport, a, b, disconnectA, disconnectB } = fixture();
    const runA = await a.startRun({ message: user("user-a") });
    const runB = await b.startRun({ message: user("user-b") });
    disconnectA();
    expect(transport.requests[0].options.abortSignal?.aborted).toBe(false);
    await b.stop();
    await runB.finished;
    expect(transport.requests[1].options.abortSignal?.aborted).toBe(true);
    expect(transport.requests[0].options.abortSignal?.aborted).toBe(false);
    transport.finish(0, "answer-a");
    await runA.finished;
    expect(thread.getMessage("answer-a")).toBeDefined();
    disconnectB();
  });
  it("regenerates from the explicit view target without changing another selection", async () => {
    const { thread, transport, a, b, disconnectA, disconnectB } = fixture();
    const first = await a.startRun({ message: user("user-a") });
    transport.finish(0, "answer-a");
    await first.finished;
    const retry = a.regenerate();
    expect(b.store.getState().cursorId).toBe("root");
    expect(transport.requests[1].options.messages.map((m) => m.id)).toEqual([
      "root",
      "user-a",
    ]);
    transport.finish(1, "retry-a");
    await retry;
    expect(a.store.getState().cursorId).toBe("retry-a");
    expect(thread.getSnapshot().cursorId).toBe("root");
    disconnectA();
    disconnectB();
  });
  it("retains a panel's command target after its source view moves and unmounts", async () => {
    const { thread, transport, a, b, disconnectA, disconnectB } = fixture();
    const first = await a.startRun({ message: user("user-a") });
    transport.finish(0, "answer-a");
    await first.finished;
    const origin = createArtifactOrigin(a, "answer-a", "openai/gpt-4o-mini");
    a.select("root");
    disconnectA();
    const pending = origin.sendMessage(user("panel-edit"));
    await Promise.resolve();
    await Promise.resolve();
    expect(thread.getParent("panel-edit")?.id).toBe("answer-a");
    expect(a.store.getState().cursorId).toBe("root");
    expect(b.store.getState().cursorId).toBe("root");
    transport.finish(1, "panel-answer");
    await pending;
    expect(origin.messageId).toBe("answer-a");
    disconnectB();
  });
  it("retains named view selection across remounts but rejects a pending send from the old mount", async () => {
    const { thread, transport, disconnectA, disconnectB } = fixture();
    const view = getConversationView({ id: "retained", thread });
    const disconnect = view.connect();
    const pending = view.startRun({ message: user("late-remount") });
    disconnect();
    const remounted = getConversationView({ id: "retained", thread });
    const cleanup = remounted.connect();
    expect(remounted).toBe(view);
    const run = await pending;
    transport.finish(0, "late-remount-answer");
    await run.finished;
    expect(remounted.store.getState().cursorId).toBe("root");
    cleanup();
    disconnectA();
    disconnectB();
  });
});
