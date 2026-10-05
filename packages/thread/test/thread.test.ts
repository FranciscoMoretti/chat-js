import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import { getMessageText } from "#thread-source/message-utils";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyMessageValue } from "#thread-source/message-utils";
/* oxlint-enable sort-imports */
import { Thread } from "#thread-source/thread";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  MemoryThreadState,
  createThreadStateSnapshot,
} from "#thread-source/thread-state";
/* oxlint-enable sort-imports */
import type { ThreadState } from "#thread-source/types";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { RecordingThreadState } from "./support/recording-thread-state";
/* oxlint-enable sort-imports */
import { StateBackedThread } from "./support/state-backed-thread";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ControlledTransport } from "./support/thread-controlled-transport";
/* oxlint-enable sort-imports */
import { ResumeTransport } from "./support/thread-resume-transport";

const user = (id: string): UIMessage => ({
  id,
  parts: [{ text: id, type: "text" }],
  role: "user",
});

const assistantWithTool = (id: string): UIMessage => ({
  id,
  parts: [
    {
      approval: { id: "shared-approval" },
      input: { value: id },
      state: "approval-requested",
      toolCallId: "shared-tool",
      toolName: "test-tool",
      type: "dynamic-tool",
    },
  ],
  role: "assistant",
});

const requireMessage = <TMessage extends ReadonlyMessageValue<UIMessage>>(
  message: TMessage | undefined
): TMessage => {
  if (!message) {
    throw new Error("Expected message to exist");
  }
  return message;
};

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
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
describe("Thread", (): void => {
  test("creates a complete initial snapshot for custom state adapters", (): void => {
    const snapshot = createThreadStateSnapshot({
      messages: [user("user-1")],
    });

    expect(snapshot.cursorId).toBe("user-1");
    expect(
      snapshot.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-1"]);
    expect(snapshot.messagesById["user-1"]?.id).toBe("user-1");
    expect(snapshot.parentById["user-1"]).toBeNull();
    expect(snapshot.rootIds).toEqual(["user-1"]);
    expect(snapshot.runs).toEqual([]);
    expect(snapshot.status).toBe("ready");
    expect(snapshot.treeStatus).toBe("ready");
  });

  test("publishes synchronous atomic updates through a custom state", (): void => {
    const state = new RecordingThreadState([user("user-1")]);
    const thread = new StateBackedThread(state);
    let notifications = 0;
    const unsubscribe = state.subscribe((): void => {
      notifications += 1;
    });

    thread.setCursor(null);
    thread.setCursor("user-1");

    expect(state.getSnapshot().cursorId).toBe("user-1");
    expect(
      state
        .getSnapshot()
        .messages.map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["user-1"]);
    expect(state.updateCount).toBe(3);
    expect(notifications).toBe(2);
    unsubscribe();
  });

  test("rejects a state implementation that does not update synchronously", (): void => {
    const memory = new MemoryThreadState();
    const state: ThreadState = {
      getSnapshot: memory.getSnapshot,
      subscribe: memory.subscribe,
      update: (): void => {
        // This invalid implementation intentionally ignores the state updater.
      },
    };

    expect(() => new StateBackedThread(state)).toThrow(
      "ThreadState.update must invoke its updater exactly once and synchronously"
    );
  });

  test("rejects sharing one state between multiple controllers", (): void => {
    const state = new RecordingThreadState([user("user-1")]);
    void new StateBackedThread(state);

    expect(() => new StateBackedThread(state)).toThrow(
      "ThreadState is already attached to an AbstractThread; retain and reuse that controller"
    );
  });

  test("streams concurrent responses into separate assistant siblings", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const primary = await chat.startRun({
      follow: true,
      message: user("user-1"),
    });
    const alternative = await chat.startRun({
      follow: false,
      from: "user-1",
    });
    await waitFor((): boolean => transport.requests.length === 2);

    transport.emitText(1, "assistant-2", "second");
    transport.emitText(0, "assistant-1", "first");
    await Promise.all([primary.finished, alternative.finished]);

    expect(
      chat
        .getSiblings("assistant-1")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["assistant-1", "assistant-2"]);
    expect(chat.getSnapshot().cursorId).toBe("assistant-1");
  });

  test("keeps a submitted response out of the tree until streaming starts", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const run = await chat.startRun({
      message: user("user-1"),
    });
    await waitFor((): boolean => transport.requests.length === 1);

    const runId = run.id;
    expect(chat.getChildren("user-1")).toEqual([]);
    expect(
      chat
        .getSnapshot()
        .messages.map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["user-1"]);
    expect(run.getSnapshot()?.status).toBe("submitted");
    transport.emitText(0, "server-assistant", "claimed");
    await run.finished;
    expect(run.id).toBe(runId);
    expect(
      getMessageText(requireMessage(chat.getMessage("server-assistant")))
    ).toBe("claimed");
    const snapshotMessage = chat
      .getSnapshot()
      .nodes.find(
        ({
          message,
        }: Readonly<{ message: Readonly<Pick<UIMessage, "id">> }>): boolean =>
          message.id === "server-assistant"
      )?.message;
    expect(getMessageText(requireMessage(snapshotMessage))).toBe("claimed");
  });

  test("uses AI SDK's client response ID when the stream omits one", async (): Promise<void> => {
    const generatedIds = ["run-1", "client-response"];
    const transport = new ControlledTransport();
    const chat = new Thread({
      generateId: (): string => generatedIds.shift() ?? "unexpected-id",
      id: "thread-1",
      transport,
    });
    const run = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);

    transport.emit(0, { id: "text", type: "text-start" });
    transport.emit(0, {
      delta: "client identity",
      id: "text",
      type: "text-delta",
    });
    transport.emit(0, { id: "text", type: "text-end" });
    transport.finish(0);
    await run.finished;

    expect(run.id).toBe("run-1");
    expect(chat.getMessage("client-response")?.id).toBe("client-response");
  });

  test("attaches streamed output without requiring a user parent", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const run = await chat.startRun({
      message: {
        id: "context-1",
        parts: [{ text: "System context", type: "text" }],
        role: "system",
      },
    });
    await waitFor((): boolean => transport.requests.length === 1);

    transport.emitText(0, "response-1", "complete");
    await run.finished;

    expect(chat.getMessage("context-1")?.role).toBe("system");
    expect(chat.getParent("response-1")?.id).toBe("context-1");
  });

  test("rejects a bare run from an assistant before transport", (): void => {
    const transport = new ControlledTransport();
    const parent: UIMessage = {
      id: "assistant-parent",
      parts: [{ text: "first", type: "text" }],
      role: "assistant",
    };
    const chat = new Thread({ messages: [parent], transport });

    expect(chat.startRun({ from: parent.id })).rejects.toThrow(
      "Cannot start a new run directly from assistant message assistant-parent; attach an input message first"
    );
    expect(transport.requests).toHaveLength(0);
    expect(chat.getTreeSnapshot().nodes).toHaveLength(1);
    expect(chat.getSnapshot().runs).toHaveLength(0);
  });

  test("continues an explicit assistant input in the same tree node", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ messages: [user("user-1")], transport });

    const sending = chat.sendMessage({
      id: "assistant-input",
      parts: [{ text: "prebuilt response", type: "text" }],
      role: "assistant",
    });
    await waitFor((): boolean => transport.requests.length === 1);

    expect(transport.requests[0]?.options.trigger).toBe("submit-message");
    expect(transport.requests[0]?.options.messageId).toBeUndefined();
    expect(
      transport.requests[0]?.options.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-1", "assistant-input"]);
    expect(chat.getParent("assistant-input")?.id).toBe("user-1");
    expect(chat.getSnapshot().cursorId).toBe("assistant-input");

    transport.emitText(0, "assistant-input", "continued");
    await sending;

    expect(
      chat
        .getChildren("user-1")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["assistant-input"]);
    expect(
      getMessageText(requireMessage(chat.getMessage("assistant-input")))
    ).toBe("prebuilt responsecontinued");
  });

  test("continues the selected assistant without creating a sibling", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const assistant = {
      ...user("assistant-1"),
      role: "assistant" as const,
    };
    const chat = new Thread({
      messages: [user("user-1"), assistant],
      transport,
    });

    const sending = chat.sendMessage();
    await waitFor((): boolean => transport.requests.length === 1);

    expect(transport.requests[0]?.options.trigger).toBe("submit-message");
    expect(transport.requests[0]?.options.messageId).toBe("assistant-1");
    transport.emitText(0, "assistant-1", " continued");
    await sending;

    expect(
      chat
        .getChildren("user-1")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["assistant-1"]);
    expect(getMessageText(requireMessage(chat.getMessage("assistant-1")))).toBe(
      "assistant-1 continued"
    );
  });

  test("keeps hidden branches when reconciling the selected path", (): void => {
    const chat = new Thread({
      messages: [user("user-1"), { ...user("assistant-1"), role: "assistant" }],
    });
    chat.addMessage(user("user-2"), "assistant-1");
    chat.addMessage({ ...user("assistant-2"), role: "assistant" }, "user-2");

    chat.setMessages([
      user("user-1"),
      { ...user("assistant-1"), role: "assistant" },
      user("user-3"),
    ]);

    expect(chat.getMessage("assistant-2")?.id).toBe("assistant-2");
    expect(
      chat
        .getSnapshot()
        .messages.map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["user-1", "assistant-1", "user-3"]);
  });

  test("does not follow a delayed run after the active path changes", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const primary = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);

    chat.setMessages([user("user-1")]);
    transport.emitText(0, "assistant-1", "primary");
    await primary.finished;

    expect(chat.getMessage("assistant-1")?.id).toBe("assistant-1");
    expect(chat.getSnapshot().cursorId).toBe("user-1");
  });

  test("reports the completed run path to onFinish after navigation", async (): Promise<void> => {
    const transport = new ControlledTransport();
    let finishedMessages:
      | readonly ReadonlyMessageValue<UIMessage>[]
      | undefined;
    const chat = new Thread({
      onFinish: ({
        messages,
      }: Readonly<{
        messages: readonly ReadonlyMessageValue<UIMessage>[];
      }>): void => {
        finishedMessages = messages;
      },
      transport,
    });
    const run = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);
    chat.addMessage(user("other-root"), null);
    chat.setCursor("other-root");

    transport.emitText(0, "assistant-1", "complete");
    await run.finished;

    expect(
      finishedMessages?.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-1", "assistant-1"]);
  });

  test("rejects concurrency before adding another user message", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      concurrency: { maxActiveRuns: 1 },
      transport,
    });
    await chat.startRun({
      message: user("user-1"),
    });

    expect(
      chat.startRun({
        message: user("user-2"),
      })
    ).rejects.toThrow("max active runs");
    expect(chat.getMessage("user-2")).toBeUndefined();
  });

  test("rejects assistant continuation without creating a phantom run", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      concurrency: { maxActiveRuns: 1 },
      initialTree: {
        cursorId: "user-active",
        nodes: [
          { message: user("user-active"), parentId: null },
          {
            message: { ...user("assistant-ready"), role: "assistant" },
            parentId: null,
          },
        ],
        version: 1,
      },
      transport,
    });
    const active = await chat.startRun({ from: "user-active" });
    await waitFor((): boolean => transport.requests.length === 1);
    const runCount = chat.getSnapshot().runs.length;

    expect(
      chat.sendMessage(undefined, {
        tree: { follow: false, from: "assistant-ready" },
      })
    ).rejects.toThrow("max active runs");

    expect(chat.getSnapshot().runs).toHaveLength(runCount);
    expect(chat.getRunForMessage("assistant-ready")).toBeUndefined();
    transport.finish(0);
    await active.finished;
  });

  test("stopping one run does not abort another", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const first = await chat.startRun({
      message: user("user-1"),
    });
    const second = await chat.startRun({
      from: "user-1",
    });
    await waitFor((): boolean => transport.requests.length === 2);

    await first.stop();
    expect(transport.requests[0]?.abortSignal?.aborted).toBeTrue();
    expect(transport.requests[1]?.abortSignal?.aborted).toBeFalse();
    expect(chat.getChildren("user-1")).toEqual([]);
    transport.emitText(1, "assistant-2", "complete");
    await second.finished;
  });

  test("selects and follows a pending run before its response exists", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ messages: [user("user-1")], transport });
    const first = await chat.startRun({ from: "user-1" });
    const second = await chat.startRun({ follow: false, from: "user-1" });
    await waitFor((): boolean => transport.requests.length === 2);

    chat.setActiveRun(second.id);

    expect(chat.getSnapshot().status).toBe("submitted");
    expect(chat.getSnapshot().cursorId).toBe("user-1");
    expect(
      chat
        .getSnapshot()
        .messages.map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["user-1"]);

    transport.emit(1, { messageId: "assistant-2", type: "start" });
    await waitFor((): boolean => chat.getSnapshot().cursorId === "assistant-2");

    expect(
      chat
        .getSnapshot()
        .messages.map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["user-1", "assistant-2"]);
    await chat.stop();
    expect(transport.requests[1]?.abortSignal?.aborted).toBeTrue();
    expect(transport.requests[0]?.abortSignal?.aborted).toBeFalse();

    transport.finish(0);
    await Promise.all([first.finished, second.finished]);
  });

  test("rejects selecting an unknown run", (): void => {
    const chat = new Thread({ messages: [user("user-1")] });

    expect((): void => chat.setActiveRun("missing")).toThrow(
      "Unknown run missing"
    );
  });

  test("preserves the selected run when its target path is missing", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ messages: [user("user-1")], transport });
    const first = await chat.startRun({ from: "user-1" });
    const second = await chat.startRun({ follow: false, from: "user-1" });
    await waitFor((): boolean => transport.requests.length === 2);
    chat.setActiveRun(first.id);
    chat.removeMessage("user-1");

    expect((): void => chat.setActiveRun(second.id)).toThrow();
    await chat.stop();

    expect(transport.requests[0]?.abortSignal?.aborted).toBeTrue();
    expect(transport.requests[1]?.abortSignal?.aborted).toBeFalse();
    transport.finish(1);
    await Promise.all([first.finished, second.finished]);
  });

  test("keeps creation order after an earlier run fails without a message", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const failed = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);
    transport.fail(0, new Error("failed before start"));
    await failed.finished;

    const second = await chat.startRun({ from: "user-1" });
    const third = await chat.startRun({ follow: false, from: "user-1" });
    await waitFor((): boolean => transport.requests.length === 3);
    transport.emitText(2, "assistant-3", "third");
    transport.emitText(1, "assistant-2", "second");
    await Promise.all([second.finished, third.finished]);

    expect(
      chat
        .getChildren("user-1")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["assistant-2", "assistant-3"]);
  });

  test("preserves an error when resume finds no stream", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const run = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);
    transport.fail(0, new Error("failed"));
    await run.finished;
    const error = run.getSnapshot()?.error;

    await chat.resumeRun(run.id);

    expect(run.getSnapshot()).toMatchObject({ error, status: "error" });
    chat.clearError();
    expect(run.getSnapshot()).toMatchObject({
      error: undefined,
      status: "ready",
    });
  });

  test("run handles expose the current resumed request", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const run = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);
    transport.emitText(0, "assistant-1", "first");
    await run.finished;
    const initialFinished = run.finished;
    const reconnect = transport.prepareReconnect();

    const resumed = chat.resumeRun(run.id);

    expect(run.finished).not.toBe(initialFinished);
    let finished = false;
    // oxlint-disable-next-line promise/always-return, promise/prefer-await-to-then -- Observe completion without awaiting or adding a value so the pending resumed request remains testable.
    void run.finished.then((): void => {
      finished = true;
    });
    await Bun.sleep(0);
    expect(finished).toBeFalse();
    reconnect.close();
    await Promise.all([resumed, run.finished]);
  });

  test("refreshes the canonical message path before resuming", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const run = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);
    transport.emitText(0, "assistant-1", "original");
    await run.finished;
    chat.setMessages([
      user("user-1"),
      {
        id: "assistant-1",
        parts: [{ text: "edited ", type: "text" }],
        role: "assistant",
      },
    ]);
    const reconnect = transport.prepareReconnect();

    const resumed = chat.resumeRun(run.id);
    await Bun.sleep(0);
    reconnect.enqueue({ id: "resumed", type: "text-start" });
    reconnect.enqueue({ delta: "resumed", id: "resumed", type: "text-delta" });
    reconnect.enqueue({ id: "resumed", type: "text-end" });
    reconnect.enqueue({ finishReason: "stop", type: "finish" });
    reconnect.close();
    await resumed;

    expect(getMessageText(requireMessage(chat.getMessage("assistant-1")))).toBe(
      "edited resumed"
    );
  });

  test("replays a v7 resume from start without duplicating canonical content", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      messages: [
        user("user-1"),
        {
          id: "assistant-1",
          parts: [{ text: "partial", type: "text" }],
          role: "assistant",
        },
      ],
      transport,
    });
    const reconnect = transport.prepareReconnect();
    const resumed = chat.resumeStream();
    reconnect.enqueue({ messageId: "assistant-1", type: "start" });
    reconnect.enqueue({ id: "text", type: "text-start" });
    reconnect.enqueue({
      delta: "complete replay",
      id: "text",
      type: "text-delta",
    });
    reconnect.enqueue({ id: "text", type: "text-end" });
    reconnect.enqueue({ finishReason: "stop", type: "finish" });
    reconnect.close();
    await resumed;
    expect(getMessageText(requireMessage(chat.getMessage("assistant-1")))).toBe(
      "complete replay"
    );
    expect(
      chat
        .getChildren("user-1")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["assistant-1"]);
  });

  test("keeps canonical identity and metadata when a replay start omits them", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      messages: [
        user("user-1"),
        {
          id: "assistant-1",
          metadata: { model: "saved" },
          parts: [{ text: "partial", type: "text" }],
          role: "assistant",
        },
      ],
      transport,
    });
    const reconnect = transport.prepareReconnect();
    const resumed = chat.resumeStream();
    reconnect.enqueue({ type: "start" });
    reconnect.enqueue({ id: "text", type: "text-start" });
    reconnect.enqueue({ delta: "replayed", id: "text", type: "text-delta" });
    reconnect.enqueue({ id: "text", type: "text-end" });
    reconnect.close();
    await resumed;
    const message = requireMessage(chat.getMessage("assistant-1"));
    expect(getMessageText(message)).toBe("replayed");
    expect(message.metadata).toEqual({ model: "saved" });
    expect(chat.getChildren("user-1")).toHaveLength(1);
  });

  test("updates restored tools after a continuation without duplicating the prefix", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      messages: [
        user("user-1"),
        {
          id: "assistant-1",
          parts: [
            { text: "prefix ", type: "text" },
            {
              input: {},
              state: "input-available",
              toolCallId: "restored-tool",
              toolName: "lookup",
              type: "dynamic-tool",
            },
          ],
          role: "assistant",
        },
      ],
      transport,
    });
    const reconnect = transport.prepareReconnect();
    const resumed = chat.resumeStream();
    reconnect.enqueue({ id: "text", type: "text-start" });
    reconnect.enqueue({ delta: "suffix", id: "text", type: "text-delta" });
    reconnect.enqueue({ id: "text", type: "text-end" });
    reconnect.close();
    await resumed;
    await chat.addToolOutput({
      output: "found",
      tool: "lookup",
      toolCallId: "restored-tool",
    });
    const message = requireMessage(chat.getMessage("assistant-1"));
    expect(getMessageText(message)).toBe("prefix suffix");
    expect(
      message.parts.filter(
        (part: Readonly<Pick<UIMessage["parts"][number], "type">>) =>
          part.type === "dynamic-tool"
      )
      // oxlint-disable-next-line typescript/no-unsafe-argument -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
    ).toEqual([
      expect.objectContaining({
        output: "found",
        state: "output-available",
        toolCallId: "restored-tool",
      }),
    ]);
  });

  test("aggregate status ignores historical run errors", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const failed = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);
    transport.fail(0, new Error("failed"));
    await failed.finished;
    expect(chat.getSnapshot().treeStatus).toBe("ready");
    expect(failed.getSnapshot()?.status).toBe("error");

    const successful = await chat.startRun({ from: "user-1" });
    await waitFor((): boolean => transport.requests.length === 2);
    expect(chat.getSnapshot().treeStatus).toBe("submitted");
    transport.emitText(1, "assistant-1", "recovered");
    await successful.finished;

    expect(chat.getSnapshot().status).toBe("ready");
    expect(chat.getSnapshot().treeStatus).toBe("ready");
    expect(failed.getSnapshot()?.status).toBe("error");
  });

  test("unexpected application errors reject the run promise", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const state = new RecordingThreadState([]);
    const chat = new StateBackedThread(state, transport);
    chat.sendAutomaticallyWhen = (): never => {
      throw new Error("application callback failed");
    };
    let publishes = 0;
    const unsubscribe = state.subscribe((): void => {
      publishes += 1;
    });
    const run = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);
    const publishesBeforeCompletion = publishes;
    transport.emitText(0, "assistant-1", "complete");

    expect(run.finished).rejects.toThrow("application callback failed");
    expect(publishes).toBeGreaterThan(publishesBeforeCompletion);
    unsubscribe();
  });

  test("regenerates an assistant as a sibling response", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const first = await chat.startRun({
      message: user("user-1"),
    });
    await waitFor((): boolean => transport.requests.length === 1);
    transport.emitText(0, "assistant-1", "first");
    await first.finished;

    const regeneration = chat.regenerate({ messageId: "assistant-1" });
    await waitFor((): boolean => transport.requests.length === 2);
    expect(transport.requests[1]?.options.trigger).toBe("regenerate-message");
    expect(transport.requests[1]?.options.messageId).toBe("assistant-1");
    expect(
      transport.requests[1]?.options.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual(["user-1"]);
    transport.emitText(1, "assistant-2", "second");
    await regeneration;

    expect(
      chat
        .getSiblings("assistant-1")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["assistant-1", "assistant-2"]);
    expect(chat.getSnapshot().cursorId).toBe("assistant-2");
  });

  test("regenerates a root assistant as a root sibling", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      messages: [{ ...user("assistant-1"), role: "assistant" }],
      transport,
    });

    const regeneration = chat.regenerate({ messageId: "assistant-1" });
    await waitFor((): boolean => transport.requests.length === 1);
    expect(transport.requests[0]?.options.trigger).toBe("regenerate-message");
    expect(transport.requests[0]?.options.messageId).toBe("assistant-1");
    expect(transport.requests[0]?.options.messages).toEqual([]);

    transport.emitText(0, "assistant-2", "second");
    await regeneration;

    expect(
      chat
        .getSiblings("assistant-1")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["assistant-1", "assistant-2"]);
    expect(chat.getSnapshot().cursorId).toBe("assistant-2");
  });

  test("does not follow regeneration after navigating to another branch", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      messages: [user("user-1"), { ...user("assistant-1"), role: "assistant" }],
      transport,
    });
    chat.addMessage(user("other-root"), null);

    const regeneration = chat.regenerate({ messageId: "assistant-1" });
    await waitFor((): boolean => transport.requests.length === 1);
    chat.setCursor("other-root");
    transport.emitText(0, "assistant-2", "second");
    await regeneration;

    expect(chat.getParent("assistant-2")?.id).toBe("user-1");
    expect(chat.getSnapshot().cursorId).toBe("other-root");
    expect(
      chat
        .getSnapshot()
        .messages.map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual(["other-root"]);
  });

  test("rejects an unknown explicit regeneration target", (): void => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      messages: [user("user-1"), { ...user("assistant-1"), role: "assistant" }],
      transport,
    });

    expect(chat.regenerate({ messageId: "missing" })).rejects.toThrow(
      "message missing not found"
    );
    expect(transport.requests).toHaveLength(0);
    expect(chat.getSnapshot().cursorId).toBe("assistant-1");
  });

  test("regenerates an assistant whose parent is an assistant", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const assistantParent = {
      ...user("assistant-parent"),
      role: "assistant" as const,
    };
    const assistantChild = {
      ...user("assistant-child"),
      role: "assistant" as const,
    };
    const chat = new Thread({
      messages: [assistantParent, assistantChild],
      transport,
    });

    const regeneration = chat.regenerate({ messageId: assistantChild.id });
    await waitFor((): boolean => transport.requests.length === 1);
    expect(transport.requests[0]?.options.trigger).toBe("regenerate-message");
    expect(transport.requests[0]?.options.messageId).toBe(assistantChild.id);
    expect(
      transport.requests[0]?.options.messages.map(
        ({ id }: Readonly<Pick<UIMessage, "id">>): string => id
      )
    ).toEqual([assistantParent.id]);

    transport.emitText(0, "assistant-replacement", "replacement");
    await regeneration;

    expect(
      chat
        .getChildren(assistantParent.id)
        .map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual([assistantChild.id, "assistant-replacement"]);
    expect(chat.getMessage(assistantParent.id)).toEqual(assistantParent);
    expect(chat.getMessage(assistantChild.id)).toEqual(assistantChild);
    expect(chat.getSnapshot().cursorId).toBe("assistant-replacement");
  });

  test("restores assistant-to-assistant edges as tree data", (): void => {
    const assistantParent = {
      ...user("assistant-parent"),
      role: "assistant" as const,
    };
    const assistantChild = {
      ...user("assistant-child"),
      role: "assistant" as const,
    };
    const chat = new Thread({
      initialTree: {
        cursorId: assistantChild.id,
        nodes: [
          { message: assistantParent, parentId: null },
          { message: assistantChild, parentId: assistantParent.id },
        ],
        version: 1,
      },
    });

    expect(chat.getParent(assistantChild.id)?.id).toBe(assistantParent.id);
    expect(
      chat
        .getSnapshot()
        .messages.map(({ id }: Readonly<Pick<UIMessage, "id">>): string => id)
    ).toEqual([assistantParent.id, assistantChild.id]);
  });

  test("routes tool output and approval to their owning runs", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({ transport });
    const runA = await chat.startRun({
      message: user("user-a"),
    });
    const runB = await chat.startRun({
      follow: false,
      from: null,
      message: user("user-b"),
    });
    await waitFor((): boolean => transport.requests.length === 2);
    for (const [requestIndex, assistantMessageId, toolCallId, approvalId] of [
      [0, "assistant-a", "tool-a", "approval-a"],
      [1, "assistant-b", "tool-b", "approval-b"],
    ] as const) {
      transport.emit(requestIndex, {
        messageId: assistantMessageId,
        type: "start",
      });
      transport.emit(requestIndex, {
        dynamic: true,
        input: { branch: assistantMessageId },
        toolCallId,
        toolName: "branch-tool",
        type: "tool-input-available",
      });
      transport.emit(requestIndex, {
        approvalId,
        toolCallId,
        type: "tool-approval-request",
      });
    }
    await waitFor(
      (): boolean =>
        chat.getMessage("assistant-a")?.parts.length === 1 &&
        chat.getMessage("assistant-b")?.parts.length === 1
    );
    transport.finish(0);
    transport.finish(1);
    await Promise.all([runA.finished, runB.finished]);

    await chat.addToolOutput({
      output: "A only",
      tool: "branch-tool",
      toolCallId: "tool-a",
    });
    await chat.addToolApprovalResponse({
      approved: true,
      id: "approval-b",
    });

    expect(chat.getMessage("assistant-a")?.parts).toContainEqual(
      // oxlint-disable-next-line typescript/no-unsafe-argument -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
      expect.objectContaining({ output: "A only", toolCallId: "tool-a" })
    );
    expect(chat.getMessage("assistant-b")?.parts).not.toContainEqual(
      expect.objectContaining({ output: "A only" })
    );
    expect(chat.getMessage("assistant-b")?.parts).toContainEqual(
      // oxlint-disable-next-line typescript/no-unsafe-argument -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
      expect.objectContaining({
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
        approval: expect.objectContaining({
          approved: true,
          id: "approval-b",
        }),
        state: "approval-responded",
        toolCallId: "tool-b",
      })
    );
  });

  test("reconstructs tool and approval ownership after restoring a tree", async (): Promise<void> => {
    const source = new Thread();
    source.addMessage(user("user-1"), null);
    source.addMessage(
      {
        id: "assistant-1",
        parts: [
          {
            approval: { id: "approval-1" },
            input: { value: 1 },
            state: "approval-requested",
            toolCallId: "tool-1",
            toolName: "test-tool",
            type: "dynamic-tool",
          },
        ],
        role: "assistant",
      },
      "user-1"
    );
    source.setCursor("assistant-1");
    const restored = new Thread();
    restored.restore(source.getTreeSnapshot());

    await restored.addToolApprovalResponse({
      approved: true,
      id: "approval-1",
    });
    await restored.addToolOutput({
      output: "restored output",
      tool: "test-tool",
      toolCallId: "tool-1",
    });

    expect(restored.getMessage("assistant-1")?.parts).toContainEqual(
      // oxlint-disable-next-line typescript/no-unsafe-argument -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
      expect.objectContaining({
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
        approval: expect.objectContaining({
          approved: true,
          id: "approval-1",
        }),
        output: "restored output",
        toolCallId: "tool-1",
      })
    );
  });

  test("rejects missing restored tool and approval ownership", (): void => {
    const chat = new Thread({ messages: [user("user-1")] });

    expect(
      chat.addToolOutput({
        output: "missing",
        tool: "test-tool",
        toolCallId: "missing-tool",
      })
    ).rejects.toThrow("No run owns tool call missing-tool");
    expect(
      chat.addToolApprovalResponse({
        approved: true,
        id: "missing-approval",
      })
    ).rejects.toThrow("No run owns tool approval missing-approval");
  });

  test("rejects duplicate restored tool and approval ownership", (): void => {
    const chat = new Thread({
      initialTree: {
        cursorId: "assistant-a",
        nodes: [
          { message: assistantWithTool("assistant-a"), parentId: null },
          { message: assistantWithTool("assistant-b"), parentId: null },
        ],
        version: 1,
      },
    });

    expect(
      chat.addToolOutput({
        output: "duplicate",
        tool: "test-tool",
        toolCallId: "shared-tool",
      })
    ).rejects.toThrow(
      "Tool call shared-tool appears in more than one assistant message"
    );
    expect(
      chat.addToolApprovalResponse({
        approved: true,
        id: "shared-approval",
      })
    ).rejects.toThrow(
      "Tool approval shared-approval appears in more than one assistant message"
    );
  });

  test("enforces the global concurrency limit before resuming", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      concurrency: { maxActiveRuns: 1 },
      transport,
    });
    const completed = await chat.startRun({ message: user("user-a") });
    await waitFor((): boolean => transport.requests.length === 1);
    transport.emitText(0, "assistant-a", "complete");
    await completed.finished;

    const active = await chat.startRun({
      follow: false,
      from: null,
      message: user("user-b"),
    });
    await waitFor((): boolean => transport.requests.length === 2);

    expect(chat.resumeRun(completed.id)).rejects.toThrow("max active runs");
    transport.finish(1);
    await active.finished;
  });

  test("enforces the per-message concurrency limit before resuming", async (): Promise<void> => {
    const transport = new ControlledTransport();
    const chat = new Thread({
      concurrency: { maxActiveRunsPerMessage: 1 },
      transport,
    });
    const completed = await chat.startRun({ message: user("user-1") });
    await waitFor((): boolean => transport.requests.length === 1);
    transport.emitText(0, "assistant-1", "complete");
    await completed.finished;

    const active = await chat.startRun({
      follow: false,
      from: "user-1",
    });
    await waitFor((): boolean => transport.requests.length === 2);

    expect(chat.resumeRun(completed.id)).rejects.toThrow(
      "Cannot start another run from user-1"
    );
    transport.finish(1);
    await active.finished;
  });

  test("resumes a restored assistant through its reconstructed run", async (): Promise<void> => {
    const transport = new ResumeTransport();
    const chat = new Thread({
      messages: [
        user("user-1"),
        { id: "assistant-1", parts: [], role: "assistant" },
      ],
      transport,
    });

    await chat.resumeStream();

    expect(getMessageText(requireMessage(chat.getMessage("assistant-1")))).toBe(
      "resumed"
    );
    expect(transport.lastReconnectOptions?.body).toBeUndefined();
  });

  test("resumes a restored root assistant", async (): Promise<void> => {
    const transport = new ResumeTransport();
    const chat = new Thread({
      initialTree: {
        cursorId: "assistant-root",
        nodes: [
          {
            message: {
              id: "assistant-root",
              parts: [],
              role: "assistant",
            },
            parentId: null,
          },
        ],
        version: 1,
      },
      transport,
    });

    await chat.resumeStream();

    expect(
      getMessageText(requireMessage(chat.getMessage("assistant-root")))
    ).toBe("resumed");
  });

  test("resumes a restored assistant whose parent is an assistant", async (): Promise<void> => {
    const transport = new ResumeTransport();
    const chat = new Thread({
      initialTree: {
        cursorId: "assistant-child",
        nodes: [
          {
            message: {
              id: "assistant-parent",
              parts: [{ text: "parent", type: "text" }],
              role: "assistant",
            },
            parentId: null,
          },
          {
            message: {
              id: "assistant-child",
              parts: [],
              role: "assistant",
            },
            parentId: "assistant-parent",
          },
        ],
        version: 1,
      },
      transport,
    });

    await chat.resumeStream();

    expect(
      getMessageText(requireMessage(chat.getMessage("assistant-parent")))
    ).toBe("parent");
    expect(
      getMessageText(requireMessage(chat.getMessage("assistant-child")))
    ).toBe("resumed");
  });
});
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
