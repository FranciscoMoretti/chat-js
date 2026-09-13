import { describe, expect, test } from "bun:test";

import { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import { ThreadRunChat } from "../src/ai-sdk-run-chat";
import type { ThreadRunSpec } from "../src/ai-sdk-run-chat";
import { ControlledTransport } from "./support/run-chat-controlled-transport";
import { TestRunHost } from "./support/test-run-host";

const userMessage = (): UIMessage => ({
  id: "user-1",
  parts: [{ text: "Compare me", type: "text" }],
  role: "user",
});

const createSpec = (): ThreadRunSpec => ({
  id: "run-1",
  initialPathMessageId: "user-1",
  parentMessageId: "user-1",
  siblingOrder: 0,
});

const emitRichResponse = (transport: ControlledTransport) => {
  transport.emit(
    { messageId: "assistant-1", type: "start" },
    { id: "reasoning-1", type: "reasoning-start" },
    { delta: "thinking", id: "reasoning-1", type: "reasoning-delta" },
    { id: "reasoning-1", type: "reasoning-end" },
    { id: "text-1", type: "text-start" },
    { delta: "answer", id: "text-1", type: "text-delta" },
    { id: "text-1", type: "text-end" },
    { finishReason: "stop", type: "finish" }
  );
  transport.finish();
};

const waitFor = async (predicate: () => boolean, attemptsRemaining = 500) => {
  if (predicate()) {
    return;
  }
  if (attemptsRemaining === 0) {
    throw new Error("Timed out waiting for request");
  }
  await Bun.sleep(1);
  return waitFor(predicate, attemptsRemaining - 1);
};

describe("ThreadRunChat", () => {
  test("matches the AI SDK React Chat reducer for one response", async () => {
    const spec = createSpec();
    const standardTransport = new ControlledTransport();
    const threadTransport = new ControlledTransport();
    const input = userMessage();
    const standardChat = new Chat<UIMessage>({
      generateId: () => "client-response",
      id: "standard-chat",
      transport: standardTransport,
    });
    const host = new TestRunHost(threadTransport, input, spec);
    const threadRunChat = new ThreadRunChat(host, spec);

    const standardRequest = standardChat.sendMessage(input);
    const threadRequest = threadRunChat.start();
    await Bun.sleep(0);
    expect(threadTransport.request?.messages).toEqual(
      standardTransport.request?.messages
    );
    expect(threadTransport.request?.messageId).toBe(
      standardTransport.request?.messageId
    );
    emitRichResponse(standardTransport);
    emitRichResponse(threadTransport);
    await Promise.all([standardRequest, threadRequest]);

    expect(host.tree.getMessage("assistant-1")).toEqual(
      standardChat.messages.at(-1)
    );
    expect(host.status).toBe("ready");
  });

  test("adopts the server response identity from the start chunk", async () => {
    const spec = createSpec();
    const transport = new ControlledTransport();
    const input = userMessage();
    const host = new TestRunHost(transport, input, spec);
    const chat = new ThreadRunChat(host, spec);

    const request = chat.start();
    await Bun.sleep(0);
    transport.emit(
      { messageId: "server-id", type: "start" },
      { id: "text-1", type: "text-start" },
      { delta: "answer", id: "text-1", type: "text-delta" },
      { id: "text-1", type: "text-end" }
    );
    transport.finish();
    await request;

    expect(host.tree.getMessage("client-response")).toBeUndefined();
    expect(host.tree.getMessage("server-id")?.id).toBe("server-id");
    expect(spec.messageId).toBe("server-id");
  });

  test("reports a failed stream exactly once without adding a response", async () => {
    const error = new Error("stream failed");
    const callbackErrors: Error[] = [];
    const spec = createSpec();
    const transport = new ControlledTransport();
    const host = new TestRunHost(transport, userMessage(), spec);
    host.onError = (callbackError) => callbackErrors.push(callbackError);
    const chat = new ThreadRunChat(host, spec);

    const request = chat.start();
    await waitFor(() => transport.requests.length === 1);
    transport.fail(error);
    await request;

    expect(host.errors).toEqual([error]);
    expect(callbackErrors).toEqual([error]);
    expect(host.status).toBe("error");
    expect(host.tree.getChildren(spec.parentMessageId)).toEqual([]);
  });

  test("continues one response after an automatic tool follow-up", async () => {
    const spec = createSpec();
    const transport = new ControlledTransport();
    const host = new TestRunHost(transport, userMessage(), spec);
    host.sendAutomaticallyWhen = () => transport.requests.length < 2;
    const chat = new ThreadRunChat(host, spec);

    const request = chat.start();
    await waitFor(() => transport.requests.length === 1);
    transport.emit(
      { messageId: "assistant-1", type: "start" },
      {
        dynamic: true,
        input: { city: "London" },
        toolCallId: "tool-1",
        toolName: "weather",
        type: "tool-input-available",
      },
      {
        dynamic: true,
        output: { temperature: 22 },
        toolCallId: "tool-1",
        type: "tool-output-available",
      },
      { finishReason: "tool-calls", type: "finish" }
    );
    transport.finish();

    await waitFor(() => transport.requests.length === 2);
    expect(transport.requests[1]?.options.messageId).toBe("assistant-1");
    transport.emit(
      { messageId: "assistant-1", type: "start" },
      { id: "second", type: "text-start" },
      { delta: "It is 22 degrees.", id: "second", type: "text-delta" },
      { id: "second", type: "text-end" },
      { finishReason: "stop", type: "finish" }
    );
    transport.finish();
    await request;

    expect(transport.requests).toHaveLength(2);
    expect(
      host.tree.getChildren(spec.parentMessageId).map(({ id }) => id)
    ).toEqual(["assistant-1"]);
    expect(host.tree.getMessage("assistant-1")?.parts).toEqual([
      expect.objectContaining({
        output: { temperature: 22 },
        state: "output-available",
        toolCallId: "tool-1",
        type: "dynamic-tool",
      }),
      expect.objectContaining({
        text: "It is 22 degrees.",
        type: "text",
      }),
    ]);
    expect(host.status).toBe("ready");
  });
});
