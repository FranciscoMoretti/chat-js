import { expect, test, vi } from "vitest";
import { codeExecution } from "./code-execution";

const execution = vi.hoisted(() => {
  let rejectExecution: (error: Error) => void = () => undefined;
  return {
    create: vi.fn(async () => ({})),
    run: vi.fn(
      () =>
        new Promise<unknown>((_resolve, reject) => {
          rejectExecution = reject;
        })
    ),
    cleanup: vi.fn(() => {
      rejectExecution(new Error("Sandbox stopped"));
      return Promise.resolve();
    }),
  };
});
vi.mock("./code-execution.javascript", () => ({
  executeJavaScriptInSandbox: execution.run,
}));
vi.mock("./code-execution.shared", () => ({
  createSandbox: execution.create,
  cleanupSandbox: execution.cleanup,
  getSandboxRuntime: () => "node22",
  getErrorMessage: (error: Error) => error.message,
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({
    info: () => undefined,
    debug: () => undefined,
    error: () => undefined,
  }),
}));

test("cancelling code execution stops its sandbox and settles cleanup once", async () => {
  const tool = codeExecution({
    sandboxOwnership: {
      reserve: () => Promise.resolve("named-fixture"),
      release: () => Promise.resolve(),
    },
  });
  if (!tool.execute) {
    throw new Error("Missing executor");
  }
  const controller = new AbortController();
  const result = tool.execute(
    {
      title: "Long running",
      language: "javascript",
      code: "await new Promise(() => {})",
    },
    {
      toolCallId: "cancel-fixture",
      messages: [],
      context: {},
      abortSignal: controller.signal,
    }
  );
  await vi.waitFor(() => expect(execution.run).toHaveBeenCalledOnce());
  controller.abort();
  await expect(result).resolves.toMatchObject({
    message: "Sandbox execution failed: Sandbox stopped",
  });
  expect(execution.create).toHaveBeenCalledWith(
    "node22",
    controller.signal,
    "named-fixture"
  );
  expect(execution.cleanup).toHaveBeenCalledOnce();
});

test("failed cleanup rejects the tool while retaining the cost of completed execution", async () => {
  execution.run.mockResolvedValueOnce(undefined);
  execution.cleanup.mockRejectedValueOnce(new Error("stop unavailable"));
  const costAccumulator = { addAPICost: vi.fn() };
  const tool = codeExecution({ costAccumulator });
  if (!tool.execute) {
    throw new Error("Missing executor");
  }
  await expect(
    tool.execute(
      { title: "Completed", language: "javascript", code: "console.log(42)" },
      {
        toolCallId: "cleanup-failure",
        messages: [],
        context: {},
        abortSignal: new AbortController().signal,
      }
    )
  ).rejects.toThrow("stop unavailable");
  expect(costAccumulator.addAPICost).toHaveBeenCalledWith("codeExecution", 5);
});

test("abort cleanup failures stay observed while execution is still unwinding", async () => {
  const started = Promise.withResolvers<void>();
  const completion = Promise.withResolvers<unknown>();
  execution.run.mockImplementationOnce(() => {
    started.resolve();
    return completion.promise;
  });
  execution.cleanup.mockRejectedValueOnce(new Error("abort stop failed"));
  const tool = codeExecution({});
  if (!tool.execute) {
    throw new Error("Missing executor");
  }
  const controller = new AbortController();
  const result = tool.execute(
    { title: "Aborted", language: "javascript", code: "await work()" },
    {
      toolCallId: "abort-cleanup-failure",
      messages: [],
      context: {},
      abortSignal: controller.signal,
    }
  );
  const rejected = expect(result).rejects.toThrow("abort stop failed");
  await started.promise;
  controller.abort();
  // Give an unobserved cleanup rejection a turn to surface in the test runner.
  await new Promise<void>((resolve) => setImmediate(resolve));
  completion.resolve(undefined);
  await rejected;
});

test("allocation intent precedes creation and release waits for completed cleanup", async () => {
  const reserve = vi.fn().mockResolvedValue("owned-name");
  const release = vi.fn().mockResolvedValue(undefined);
  const cleanup = Promise.withResolvers<void>();
  const previousCleanups = execution.cleanup.mock.calls.length;
  execution.run.mockResolvedValueOnce({ message: "42", chart: "" });
  execution.cleanup.mockReturnValueOnce(cleanup.promise);
  const tool = codeExecution({ sandboxOwnership: { reserve, release } });
  if (!tool.execute) {
    throw new Error("Missing executor");
  }
  const result = tool.execute(
    { title: "Owned", language: "javascript", code: "42" },
    { toolCallId: "owned", messages: [], context: {} }
  );
  await vi.waitFor(() =>
    expect(execution.cleanup).toHaveBeenCalledTimes(previousCleanups + 1)
  );
  expect(release).not.toHaveBeenCalled();
  expect(reserve.mock.invocationCallOrder[0]).toBeLessThan(
    execution.create.mock.invocationCallOrder.at(-1) ?? 0
  );
  expect(execution.create).toHaveBeenLastCalledWith(
    "node22",
    undefined,
    "owned-name"
  );
  cleanup.resolve();
  await result;
  expect(release).toHaveBeenCalledOnce();
});

test("unknown allocation outcomes and failed deletion retain durable ownership", async () => {
  const reserve = vi.fn().mockResolvedValue("unresolved-name");
  const release = vi.fn().mockResolvedValue(undefined);
  const tool = codeExecution({ sandboxOwnership: { reserve, release } });
  if (!tool.execute) {
    throw new Error("Missing executor");
  }
  execution.create.mockRejectedValueOnce(new Error("lost create response"));
  await tool.execute(
    { title: "Lost", language: "javascript", code: "42" },
    { toolCallId: "lost", messages: [], context: {} }
  );
  expect(release).not.toHaveBeenCalled();
  execution.run.mockResolvedValueOnce({ message: "42", chart: "" });
  execution.cleanup.mockRejectedValueOnce(new Error("delete failed"));
  await expect(
    tool.execute(
      { title: "Lost", language: "javascript", code: "42" },
      { toolCallId: "lost", messages: [], context: {} }
    )
  ).rejects.toThrow("delete failed");
  expect(release).not.toHaveBeenCalled();
});
