import { expect, test, vi } from "vitest";
import { codeExecution } from "./code-execution";

const execution = vi.hoisted(() => {
  let rejectExecution: (error: Error) => void = () => undefined;
  return {
    create: vi.fn(async () => ({})),
    run: vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
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
  const tool = codeExecution({});
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
  expect(execution.create).toHaveBeenCalledWith("node22", controller.signal);
  expect(execution.cleanup).toHaveBeenCalledOnce();
});
