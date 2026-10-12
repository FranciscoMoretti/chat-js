import { expect, mock, test } from "bun:test";
import type { ThreadRunHandle } from "#thread-source/types";
import { Thread } from "#thread-source/thread";
import { createThreadHelpers } from "#thread-source/thread-hook-helpers";

test("tree helpers preserve controller promises and synchronous failures", () => {
  const thread = new Thread();
  const completion = Promise.resolve();
  const handle = Promise.withResolvers<ThreadRunHandle>().promise;
  thread.resumeRun =
    mock<typeof thread.resumeRun>().mockReturnValue(completion);
  thread.startRun = mock<typeof thread.startRun>().mockReturnValue(handle);
  thread.stopAll = mock<typeof thread.stopAll>().mockReturnValue(completion);
  thread.stopRun = mock<typeof thread.stopRun>().mockReturnValue(completion);
  thread.stopRunForMessage =
    mock<typeof thread.stopRunForMessage>().mockReturnValue(completion);
  const { tree } = createThreadHelpers({
    error: undefined,
    setMessages: () => {},
    snapshot: thread.getSnapshot(),
    status: "ready",
    thread,
    treeStatus: "ready",
  });
  expect(tree.startRun()).toBe(handle);
  expect(tree.resumeRun("run")).toBe(completion);
  expect(tree.stopAll()).toBe(completion);
  expect(tree.stopRun("run")).toBe(completion);
  expect(tree.stopRunForMessage("message")).toBe(completion);

  const failure = new Error("controller validation");
  const fail = (): never => {
    throw failure;
  };
  thread.startRun = fail;
  thread.resumeRun = fail;
  thread.stopAll = fail;
  thread.stopRun = fail;
  thread.stopRunForMessage = fail;
  expect(() => {
    void tree.startRun();
  }).toThrow(failure);
  expect(() => {
    void tree.resumeRun("run");
  }).toThrow(failure);
  expect(() => {
    void tree.stopAll();
  }).toThrow(failure);
  expect(() => {
    void tree.stopRun("run");
  }).toThrow(failure);
  expect(() => {
    void tree.stopRunForMessage("message");
  }).toThrow(failure);
});

test("stopRunForMessage preserves the addressed stopRun override boundary", () => {
  const thread = new Thread();
  const completion = Promise.resolve();
  thread.getRunForMessage = mock<
    typeof thread.getRunForMessage
  >().mockReturnValue({
    error: undefined,
    id: "run",
    status: "ready",
  });
  const stopRun = mock<typeof thread.stopRun>().mockReturnValue(completion);
  thread.stopRun = stopRun;
  expect(thread.stopRunForMessage("message")).toBe(completion);
  expect(stopRun).toHaveBeenCalledWith("run");
  const failure = new Error("stop validation");
  thread.stopRun = (): never => {
    throw failure;
  };
  expect(() => {
    void thread.stopRunForMessage("message");
  }).toThrow(failure);
});

test("regenerate reports a synchronous transport failure before returning", async () => {
  const failure = new Error("transport validation");
  const onError = mock<(error: Error) => void>();
  const thread = new Thread({
    messages: [
      { id: "user", role: "user", parts: [{ type: "text", text: "hello" }] },
    ],
    onError,
    transport: {
      reconnectToStream: mock().mockResolvedValue(null),
      sendMessages: (): never => {
        throw failure;
      },
    },
  });
  const request = thread.regenerate();
  expect(onError).toHaveBeenCalledWith(failure);
  await request;
});
