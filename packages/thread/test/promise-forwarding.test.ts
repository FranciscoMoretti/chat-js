import { expect, mock, test } from "bun:test";
import type { ThreadRunHandle } from "#thread-source/types";
import { Thread } from "#thread-source/thread";
import { createThreadHelpers } from "#thread-source/thread-hook-helpers";

test("tree helpers await controller results and reject controller failures", async () => {
  const thread = new Thread();
  const completion = Promise.resolve();
  const handle: ThreadRunHandle = {
    id: "run",
    finished: completion,
    getSnapshot: () => thread.getRun("run"),
    stop: mock<() => Promise<void>>().mockResolvedValue(),
  };
  thread.resumeRun =
    mock<typeof thread.resumeRun>().mockReturnValue(completion);
  thread.startRun = mock<typeof thread.startRun>().mockResolvedValue(handle);
  const stopAll = mock<typeof thread.stopAll>().mockReturnValue(completion);
  thread.stopAll = stopAll;
  const stopRun = mock<typeof thread.stopRun>().mockReturnValue(completion);
  thread.stopRun = stopRun;
  const stopRunForMessage =
    mock<typeof thread.stopRunForMessage>().mockReturnValue(completion);
  thread.stopRunForMessage = stopRunForMessage;
  const { tree } = createThreadHelpers({
    error: undefined,
    setMessages: () => {},
    snapshot: thread.getSnapshot(),
    status: "ready",
    thread,
    treeStatus: "ready",
  });
  expect(await tree.startRun()).toBe(handle);
  await tree.resumeRun("run");
  await tree.stopAll();
  await tree.stopRun("run");
  await tree.stopRunForMessage("message");
  expect(thread.resumeRun).toHaveBeenCalledWith("run", undefined);
  expect(stopAll).toHaveBeenCalledTimes(1);
  expect(stopRun).toHaveBeenCalledWith("run");
  expect(stopRunForMessage).toHaveBeenCalledWith("message");

  const failure = new Error("controller validation");
  const fail = (): never => {
    throw failure;
  };
  thread.startRun = fail;
  thread.resumeRun = fail;
  thread.stopAll = fail;
  thread.stopRun = fail;
  thread.stopRunForMessage = fail;
  expect(tree.startRun()).rejects.toBe(failure);
  expect(tree.resumeRun("run")).rejects.toBe(failure);
  expect(tree.stopAll()).rejects.toBe(failure);
  expect(tree.stopRun("run")).rejects.toBe(failure);
  expect(tree.stopRunForMessage("message")).rejects.toBe(failure);
});

test("stopRunForMessage awaits the addressed stopRun and rejects its failure", async () => {
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
  await thread.stopRunForMessage("message");
  expect(stopRun).toHaveBeenCalledWith("run");
  const failure = new Error("stop validation");
  thread.stopRun = (): never => {
    throw failure;
  };
  expect(thread.stopRunForMessage("message")).rejects.toBe(failure);
});

test("regenerate reports a thrown transport failure through onError", async () => {
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
  await request;
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(failure);
  expect(thread.getSnapshot().error).toBe(failure);
});

test("tree stop waits for a pending controller failure", () => {
  const thread = new Thread();
  const stop = Promise.withResolvers<undefined>();
  thread.stopRun = mock<typeof thread.stopRun>().mockReturnValue(stop.promise);
  const { tree } = createThreadHelpers({
    error: undefined,
    setMessages: () => {},
    snapshot: thread.getSnapshot(),
    status: "ready",
    thread,
    treeStatus: "ready",
  });
  const request = tree.stopRun("run");
  const failure = new Error("cancellation failed");
  stop.reject(failure);
  expect(request).rejects.toBe(failure);
});
