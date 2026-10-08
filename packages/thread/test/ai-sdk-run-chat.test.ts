import { describe, expect, test } from "bun:test";

import { Chat } from "@ai-sdk/react";

import { ControlledTransport } from "./support/run-chat-controlled-transport";
import { TestRunHost } from "./support/test-run-host";
import { ThreadRunChat } from "#thread-source/ai-sdk-run-chat";
import type { ThreadRunSpec } from "#thread-source/ai-sdk-run-chat";
import type { UIMessage } from "ai";

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

const emitRichResponse = (
  transport: Readonly<Pick<ControlledTransport, "emit" | "finish">>
): void => {
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve waitFor's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
const waitFor = async (
  predicate: () => boolean,
  attemptsRemaining = 500
): Promise<void> => {
  if (predicate()) {
    return;
  }
  if (attemptsRemaining === 0) {
    throw new Error("Timed out waiting for request");
  }
  await Bun.sleep(1);
  await waitFor(predicate, attemptsRemaining - 1);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
describe("ThreadRunChat", (): void => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test("matches the AI SDK React Chat reducer for one response", async (): Promise<void> => {
    const spec = createSpec();
    const standardTransport = new ControlledTransport();
    const threadTransport = new ControlledTransport();
    const input = userMessage();
    const standardChat = new Chat<UIMessage>({
      generateId: (): string => "client-response",
      id: "standard-chat",
      transport: standardTransport,
    });
    const host = new TestRunHost(threadTransport, input, spec);
    const threadRunChat = new ThreadRunChat(host, spec);

    const standardRequest = standardChat.sendMessage(input);
    const threadRequest = threadRunChat.start();
    await Bun.sleep(0);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading messages from threadTransport.request; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(threadTransport.request?.messages).toEqual(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading messages from standardTransport.request; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      standardTransport.request?.messages
    );
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading messageId from threadTransport.request; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(threadTransport.request?.messageId).toBe(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading messageId from standardTransport.request; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test("adopts the server response identity from the start chunk", async (): Promise<void> => {
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from host.tree.getMessage(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(host.tree.getMessage("server-id")?.id).toBe("server-id");
    expect(spec.messageId).toBe("server-id");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test("reports a failed stream exactly once without adding a response", async (): Promise<void> => {
    const error = new Error("stream failed");
    const callbackErrors: Error[] = [];
    const spec = createSpec();
    const transport = new ControlledTransport();
    const host = new TestRunHost(transport, userMessage(), spec);
    host.onError = (callbackError: Readonly<Error>): void => {
      callbackErrors.push(callbackError);
    };
    const chat = new ThreadRunChat(host, spec);

    const request = chat.start();
    await waitFor((): boolean => transport.requests.length === 1);
    transport.fail(error);
    await request;

    expect(host.errors).toEqual([error]);
    expect(callbackErrors).toEqual([error]);
    expect(host.status).toBe("error");
    expect(host.tree.getChildren(spec.parentMessageId)).toEqual([]);
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test("continues one response after an automatic tool follow-up", async (): Promise<void> => {
    const spec = createSpec();
    const transport = new ControlledTransport();
    const host = new TestRunHost(transport, userMessage(), spec);
    host.sendAutomaticallyWhen = (): boolean => transport.requests.length < 2;
    const chat = new ThreadRunChat(host, spec);

    const request = chat.start();
    await waitFor((): boolean => transport.requests.length === 1);
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

    await waitFor((): boolean => transport.requests.length === 2);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading options from transport.requests[1]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
      host.tree
        .getChildren(spec.parentMessageId)
        .map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["assistant-1"]);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading parts from host.tree.getMessage(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
