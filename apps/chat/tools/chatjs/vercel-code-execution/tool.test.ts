import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  cleanup: vi.fn(),
  python: vi.fn(),
  javascript: vi.fn(),
}));
vi.mock("./sandbox", () => ({
  createSandbox: mocks.create,
  cleanupSandbox: mocks.cleanup,
  getSandboxRuntime: (language: string) => language,
  getErrorMessage: (error: Error) => error.message,
}));
vi.mock("./python", () => ({ executePythonInSandbox: mocks.python }));
vi.mock("./javascript", () => ({
  executeJavaScriptInSandbox: mocks.javascript,
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

import { createCodeExecution } from "./tool";

const sandbox = { id: "isolated-sandbox" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue(sandbox);
  mocks.python.mockResolvedValue({ message: "4", chart: "" });
  mocks.javascript.mockResolvedValue({ message: "4", chart: "" });
});
it.each([
  "python",
  "javascript",
] as const)("dispatches %s to the sandbox and cleans up", async (language) => {
  const result = await createCodeExecution({}).execute?.(
    { title: "Calculate", language, code: "source" },
    { toolCallId: "test", messages: [], context: {} }
  );
  expect(result).toEqual({ message: "4", chart: "" });
  expect(mocks.create).toHaveBeenCalledWith(language);
  const executor = language === "python" ? mocks.python : mocks.javascript;
  const unused = language === "python" ? mocks.javascript : mocks.python;
  expect(executor).toHaveBeenCalledWith(
    expect.objectContaining({ sandbox, code: "source" })
  );
  expect(unused).not.toHaveBeenCalled();
  expect(mocks.cleanup).toHaveBeenCalledWith(
    sandbox,
    expect.anything(),
    expect.any(String)
  );
});
it("normalizes execution errors and cleans up the sandbox", async () => {
  mocks.python.mockRejectedValue(new Error("remote execution failed"));
  const result = await createCodeExecution({}).execute?.(
    { title: "Calculate", language: "python", code: "source" },
    { toolCallId: "test", messages: [], context: {} }
  );
  expect(result).toEqual({
    message: "Sandbox execution failed: remote execution failed",
    chart: "",
  });
  expect(mocks.cleanup).toHaveBeenCalledWith(
    sandbox,
    expect.anything(),
    expect.any(String)
  );
});
