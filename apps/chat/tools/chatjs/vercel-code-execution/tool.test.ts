import { beforeEach, expect, it, vi } from "vitest";
import { codeExecution } from "./tool";
import { testToolContext } from "@/tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  create: vi.fn(),
  javascript: vi.fn(),
  ownership: vi.fn(),
  python: vi.fn(),
  resolveAuth: vi.fn(),
}));

vi.mock("./execution-sandbox", () => ({
  cleanupSandbox: mocks.cleanup,
  codeSandboxCleanupCapability: { createCleanupSession: vi.fn() },
  createSandbox: mocks.create,
  getErrorMessage: (error: Readonly<Error>): string => error.message,
  getSandboxImage: (language: string): string => language,
  resolveSandboxAuth: mocks.resolveAuth,
}));

vi.mock("@/tools/chatjs/_shared/code-execution/python", () => ({
  executePythonInSandbox: mocks.python,
}));
vi.mock("@/tools/chatjs/_shared/code-execution/javascript", () => ({
  executeJavaScriptInSandbox: mocks.javascript,
}));
vi.mock(
  "@/lib/logger",
  (): {
    createModuleLogger: () => {
      debug: () => void;
      error: () => void;
      info: () => void;
    };
  } => ({
    createModuleLogger: (): {
      debug: () => void;
      error: () => void;
      info: () => void;
    } => ({
      debug: vi.fn<() => void>(),
      error: vi.fn<() => void>(),
      info: vi.fn<() => void>(),
    }),
  })
);

vi.mock("@/lib/eve/code-sandbox-ownership", () => ({
  eveCodeSandboxOwnership: mocks.ownership,
}));

const sandbox = { id: "isolated-sandbox", name: "owned-sandbox" };
const executorCases = [
  {
    language: "python",
    unused: mocks.javascript,
    used: mocks.python,
  },
  {
    language: "javascript",
    unused: mocks.python,
    used: mocks.javascript,
  },
] as const satisfies readonly {
  language: "python" | "javascript";
  used: typeof mocks.python;
  unused: typeof mocks.javascript;
}[];

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
it.each(executorCases)(
  "dispatches $language to the sandbox and cleans up",
  async ({
    language,
    used,
    unused,
  }: {
    readonly language: "python" | "javascript";
    readonly used: unknown;
    readonly unused: unknown;
  }) => {
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
    expect(used).toHaveBeenCalledWith(
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
    usage: { costUsd: 0 },
  });
  expect(mocks.cleanup).toHaveBeenCalledWith(
    sandbox,
    expect.anything(),
    expect.any(String)
  );
});
it("reserves a named sandbox and releases ownership after provider cleanup", async () => {
  const sandboxOwnership = {
    created: vi.fn<() => Promise<void>>().mockResolvedValue(),
    release: vi.fn<() => Promise<void>>().mockResolvedValue(),
    reserve: vi.fn<() => Promise<string>>().mockResolvedValue(sandbox.name),
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
  const cleanup: PromiseWithResolvers<void> = Promise.withResolvers();
  mocks.javascript.mockReturnValue(execution.promise);
  mocks.cleanup.mockImplementation(async () => {
    execution.reject(new Error("Sandbox stopped"));
    await cleanup.promise;
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
  await vi.waitFor(() => {
    expect(mocks.javascript).toHaveBeenCalledOnce();
  });
  controller.abort();
  await vi.waitFor(() => {
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  cleanup.resolve();
  await expect(result).rejects.toBe(controller.signal.reason);
});

it("retains ownership when creation outcome is unknown", async () => {
  const sandboxOwnership = {
    created: vi.fn<() => Promise<void>>().mockResolvedValue(),
    release: vi.fn<() => Promise<void>>().mockResolvedValue(),
    reserve: vi
      .fn<() => Promise<string>>()
      .mockResolvedValue("reserved-sandbox"),
  };
  mocks.ownership.mockReturnValue(sandboxOwnership);
  mocks.create.mockRejectedValueOnce(new Error("lost create response"));

  await expect(
    codeExecution.execute?.(
      { code: "source", language: "python", title: "Calculate" },
      testToolContext({ callId: "lost" })
    )
  ).resolves.toHaveProperty(
    "output.message",
    expect.stringContaining("lost create")
  );
  expect(sandboxOwnership.created).not.toHaveBeenCalled();
  expect(sandboxOwnership.release).not.toHaveBeenCalled();
});

it("retains the completed execution charge when its result is invalid", async () => {
  mocks.python.mockResolvedValue({ chart: 42, message: "4" });
  const result = await codeExecution.execute?.(
    { code: "source", language: "python", title: "Calculate" },
    testToolContext()
  );
  expect(result).toHaveProperty(
    "output.message",
    expect.stringContaining("Sandbox execution failed")
  );
  expect(result).toMatchObject({
    usage: { costUsd: 0.05 },
  });
  expect(mocks.cleanup).toHaveBeenCalledOnce();
});
