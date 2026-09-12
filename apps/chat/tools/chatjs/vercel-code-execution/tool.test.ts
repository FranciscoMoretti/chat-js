import { beforeEach, expect, it, vi } from "vitest";

import { codeExecution } from "./tool";

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  create: vi.fn(),
  javascript: vi.fn(),
  python: vi.fn(),
}));
vi.mock("./sandbox", () => ({
  cleanupSandbox: mocks.cleanup,
  createSandbox: mocks.create,
  getErrorMessage: (error: Error) => error.message,
  getSandboxRuntime: (language: string) => language,
}));
vi.mock("./python", () => ({ executePythonInSandbox: mocks.python }));
vi.mock("./javascript", () => ({
  executeJavaScriptInSandbox: mocks.javascript,
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const sandbox = { id: "isolated-sandbox" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue(sandbox);
  mocks.python.mockResolvedValue({ chart: "", message: "4" });
  mocks.javascript.mockResolvedValue({ chart: "", message: "4" });
});
it.each(["python", "javascript"] as const)(
  "dispatches %s to the sandbox and cleans up",
  async (language) => {
    const result = await codeExecution.execute?.(
      { code: "source", language, title: "Calculate" },
      { context: {}, messages: [], toolCallId: "test" }
    );
    expect(result).toEqual({ chart: "", message: "4" });
    expect(mocks.create).toHaveBeenCalledWith(language);
    const executor = language === "python" ? mocks.python : mocks.javascript;
    const unused = language === "python" ? mocks.javascript : mocks.python;
    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({ code: "source", sandbox })
    );
    expect(unused).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledWith(
      sandbox,
      expect.anything(),
      expect.any(String)
    );
  }
);
it("normalizes execution errors and cleans up the sandbox", async () => {
  mocks.python.mockRejectedValue(new Error("remote execution failed"));
  const result = await codeExecution.execute?.(
    { code: "source", language: "python", title: "Calculate" },
    { context: {}, messages: [], toolCallId: "test" }
  );
  expect(result).toEqual({
    chart: "",
    message: "Sandbox execution failed: remote execution failed",
  });
  expect(mocks.cleanup).toHaveBeenCalledWith(
    sandbox,
    expect.anything(),
    expect.any(String)
  );
});
