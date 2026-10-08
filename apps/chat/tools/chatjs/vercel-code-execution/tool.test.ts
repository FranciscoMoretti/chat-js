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
  getSandboxRuntime: (language: string): string => language,
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["python", "javascript"] as const)'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-undefined --
 * no-undefined (#519): the create call expects an omitted sandbox-name argument as undefined before the auth object; null would be a different argument and type.
 */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling codeExecution.execute; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */
it("normalizes execution errors and cleans up the sandbox", async () => {
  mocks.python.mockRejectedValue(new Error("remote execution failed"));
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling codeExecution.execute; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("reserves a named sandbox and releases ownership after provider cleanup") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("reserves a named sandbox and releases ownership after provider cleanup", async () => {
  const sandboxOwnership = {
    created: vi.fn<() => Promise<void>>().mockResolvedValue(),
    release: vi.fn<() => Promise<void>>().mockResolvedValue(),
    reserve: vi.fn<() => Promise<string>>().mockResolvedValue(sandbox.name),
  };
  mocks.ownership.mockReturnValue(sandboxOwnership);
  const abortSignal = new AbortController().signal;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling codeExecution.execute; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements --
 * max-statements (#512): it("cancelling execution starts sandbox cleanup and observes its completion") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
it("cancelling execution starts sandbox cleanup and observes its completion", async () => {
  const execution = Promise.withResolvers<never>();
  const cleanup = Promise.withResolvers<undefined>();
  mocks.javascript.mockReturnValue(execution.promise);
  /* oxlint-disable typescript/promise-function-async -- Reject execution as the cleanup side effect, then return the exact deferred cleanup promise observed by the test. */
  mocks.cleanup.mockImplementation(() => {
    execution.reject(new Error("Sandbox stopped"));
    return cleanup.promise;
  });
  /* oxlint-enable typescript/promise-function-async */
  const controller = new AbortController();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling codeExecution.execute; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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

  // oxlint-disable-next-line no-undefined -- Resolve the cleanup gate with its declared no-value result.
  cleanup.resolve(undefined);
  await expect(result).rejects.toBe(controller.signal.reason);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements */

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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling codeExecution.execute; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

it("retains the completed execution charge when its result is invalid", async () => {
  mocks.python.mockResolvedValue({ chart: 42, message: "4" });
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling codeExecution.execute; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
