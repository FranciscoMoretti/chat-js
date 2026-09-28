import { beforeEach, expect, it, vi } from "vitest";

import { testToolContext } from "@/tests/helpers/eve-tool-context";

import { codeExecution } from "./tool";

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  create: vi.fn(),
  javascript: vi.fn(),
  ownership: vi.fn(),
  python: vi.fn(),
  resolveAuth: vi.fn(),
}));
vi.mock("./sandbox", () => ({
  cleanupSandbox: mocks.cleanup,
  codeSandboxCleanupCapability: { createCleanupSession: vi.fn() },
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

vi.mock("@/lib/eve/code-sandbox-ownership", () => ({
  eveCodeSandboxOwnership: mocks.ownership,
}));

const sandbox = { id: "isolated-sandbox", name: "owned-sandbox" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.ownership.mockReturnValue({
    created: vi.fn(),
    release: vi.fn(),
    reserve: vi.fn(),
  });
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
      testToolContext()
    );
    expect(result).toMatchObject({
      output: { chart: "", message: "4" },
      usage: { costUsd: 0.05 },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      language,
      expect.any(AbortSignal),
      undefined,
      expect.objectContaining({ projectId: "project" })
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
    testToolContext()
  );
  expect(result).toMatchObject({
    output: {
      chart: "",
      message: "Sandbox execution failed: remote execution failed",
    },
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
  mocks.ownership.mockReturnValue(sandboxOwnership);
  const abortSignal = new AbortController().signal;
  await codeExecution.execute?.(
    { code: "source", language: "python", title: "Calculate" },
    testToolContext({ abortSignal })
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
    testToolContext({ abortSignal: controller.signal })
  );
  await vi.waitFor(() => expect(mocks.javascript).toHaveBeenCalledOnce());
  controller.abort();
  await vi.waitFor(() => expect(mocks.cleanup).toHaveBeenCalledOnce());
  // eslint-disable-next-line unicorn/no-useless-undefined -- PromiseWithResolvers requires its void argument.
  cleanup.resolve(undefined);
  await expect(result).rejects.toBe(controller.signal.reason);
});

it("retains ownership when creation outcome is unknown", async () => {
  const sandboxOwnership = {
    created: vi.fn(() => Promise.resolve()),
    release: vi.fn(() => Promise.resolve()),
    reserve: vi.fn(() => Promise.resolve("reserved-sandbox")),
  };
  mocks.ownership.mockReturnValue(sandboxOwnership);
  mocks.create.mockRejectedValueOnce(new Error("lost create response"));

  await expect(
    codeExecution.execute?.(
      { code: "source", language: "python", title: "Calculate" },
      testToolContext({ callId: "lost" })
    )
  ).resolves.toMatchObject({
    output: { message: expect.stringContaining("lost create") },
  });
  expect(sandboxOwnership.created).not.toHaveBeenCalled();
  expect(sandboxOwnership.release).not.toHaveBeenCalled();
});
