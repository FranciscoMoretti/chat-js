import { beforeEach, expect, it, vi } from "vitest";

import { codeExecution } from "./tool";

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  create: vi.fn(),
  javascript: vi.fn(),
  python: vi.fn(),
  resolveAuth: vi.fn(),
}));
vi.mock("./sandbox", () => ({
  cleanupSandbox: mocks.cleanup,
  createSandbox: mocks.create,
  getErrorMessage: (error: Error) => error.message,
  getSandboxRuntime: (language: string) => language,
  resolveSandboxAuth: mocks.resolveAuth,
}));
vi.mock("./python", () => ({ executePythonInSandbox: mocks.python }));
vi.mock("./javascript", () => ({
  executeJavaScriptInSandbox: mocks.javascript,
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const sandbox = { id: "isolated-sandbox", name: "owned-sandbox" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue(sandbox);
  mocks.python.mockResolvedValue({ chart: "", message: "4" });
  mocks.javascript.mockResolvedValue({ chart: "", message: "4" });
  mocks.resolveAuth.mockReturnValue({
    projectId: "project",
    teamId: "team",
    token: "token",
  });
});
it.each(["python", "javascript"] as const)(
  "dispatches %s to the sandbox and cleans up",
  async (language) => {
    const result = await codeExecution.execute?.(
      { code: "source", language, title: "Calculate" },
      { context: {}, messages: [], toolCallId: "test" }
    );
    expect(result).toEqual({ chart: "", message: "4" });
    expect(mocks.create).toHaveBeenCalledWith(
      language,
      undefined,
      undefined,
      undefined
    );
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

it("reserves a named sandbox and releases ownership after provider cleanup", async () => {
  const sandboxOwnership = {
    created: vi.fn(() => Promise.resolve()),
    release: vi.fn(() => Promise.resolve()),
    reserve: vi.fn(() => Promise.resolve(sandbox.name)),
  };
  const abortSignal = new AbortController().signal;
  await codeExecution.execute?.(
    { code: "source", language: "python", title: "Calculate" },
    {
      abortSignal,
      context: { sandboxOwnership },
      messages: [],
      toolCallId: "test",
    }
  );
  expect(sandboxOwnership.reserve).toHaveBeenCalledWith(
    { projectId: "project", teamId: "team", token: "token" },
    abortSignal
  );
  expect(mocks.create).toHaveBeenCalledWith(
    "python",
    abortSignal,
    sandbox.name,
    { projectId: "project", teamId: "team", token: "token" }
  );
  expect(sandboxOwnership.created).toHaveBeenCalledWith(sandbox.name);
  expect(mocks.cleanup.mock.invocationCallOrder[0]).toBeLessThan(
    sandboxOwnership.release.mock.invocationCallOrder[0]
  );
});

it("cancelling execution starts sandbox cleanup and observes its completion", async () => {
  const execution = Promise.withResolvers<never>();
  const cleanup = Promise.withResolvers<undefined>();
  mocks.javascript.mockReturnValue(execution.promise);
  mocks.cleanup.mockImplementation(() => {
    execution.reject(new Error("Sandbox stopped"));
    return cleanup.promise;
  });
  const controller = new AbortController();
  const result = codeExecution.execute?.(
    {
      code: "await new Promise(() => {})",
      language: "javascript",
      title: "Long running",
    },
    {
      abortSignal: controller.signal,
      context: {},
      messages: [],
      toolCallId: "cancel",
    }
  );
  await vi.waitFor(() => expect(mocks.javascript).toHaveBeenCalledOnce());
  controller.abort();
  await vi.waitFor(() => expect(mocks.cleanup).toHaveBeenCalledOnce());
  // eslint-disable-next-line unicorn/no-useless-undefined -- PromiseWithResolvers requires its void argument.
  cleanup.resolve(undefined);
  await expect(result).resolves.toMatchObject({
    message: "Sandbox execution failed: Sandbox stopped",
  });
});

it("retains ownership when creation outcome is unknown", async () => {
  const sandboxOwnership = {
    created: vi.fn(() => Promise.resolve()),
    release: vi.fn(() => Promise.resolve()),
    reserve: vi.fn(() => Promise.resolve("reserved-sandbox")),
  };
  mocks.create.mockRejectedValueOnce(new Error("lost create response"));

  await expect(
    codeExecution.execute?.(
      { code: "source", language: "python", title: "Calculate" },
      { context: { sandboxOwnership }, messages: [], toolCallId: "lost" }
    )
  ).resolves.toMatchObject({ message: expect.stringContaining("lost create") });
  expect(sandboxOwnership.created).not.toHaveBeenCalled();
  expect(sandboxOwnership.release).not.toHaveBeenCalled();
});
