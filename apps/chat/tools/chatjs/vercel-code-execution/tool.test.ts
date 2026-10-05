import { beforeEach, expect, it, vi } from "vitest";

import { testToolContext } from "@/tests/helpers/eve-tool-context";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { codeExecution } from "./tool";
/* oxlint-enable sort-imports */

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  create: vi.fn(),
  javascript: vi.fn(),
  ownership: vi.fn(),
  python: vi.fn(),
  resolveAuth: vi.fn(),
}));
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): vi.mock("./execution-sandbox") accepts error: Error; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
vi.mock("./execution-sandbox", () => ({
  cleanupSandbox: mocks.cleanup,
  codeSandboxCleanupCapability: { createCleanupSession: vi.fn() },
  createSandbox: mocks.create,
  getErrorMessage: (error: Error): string => error.message,
  getSandboxRuntime: (language: string): string => language,
  resolveSandboxAuth: mocks.resolveAuth,
}));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
vi.mock("@/tools/chatjs/_shared/code-execution/python", () => ({
  executePythonInSandbox: mocks.python,
}));
vi.mock("@/tools/chatjs/_shared/code-execution/javascript", () => ({
  executeJavaScriptInSandbox: mocks.javascript,
}));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/logger")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
/* oxlint-enable typescript/explicit-function-return-type */

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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["python", "javascript"] as const)'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-undefined --
 * no-undefined (#519): it.each(["python", "javascript"] as const)("dispatches %s to the sandbox and cleans u uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
it.each(["python", "javascript"] as const)(
  "dispatches %s to the sandbox and cleans up",
  async (language) => {
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
/* oxlint-disable no-magic-numbers, typescript/promise-function-async --
 * no-magic-numbers (#517): it("reserves a named sandbox and releases ownership after provider cleanup") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): it("reserves a named sandbox and releases ownership after provider cleanup") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("reserves a named sandbox and releases ownership after provider cleanup", async () => {
  const sandboxOwnership = {
    created: vi.fn(() => Promise.resolve()),
    release: vi.fn(() => Promise.resolve()),
    reserve: vi.fn(() => Promise.resolve(sandbox.name)),
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
/* oxlint-enable no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable max-statements, no-undefined, typescript/promise-function-async --
 * max-statements (#512): it("cancelling execution starts sandbox cleanup and observes its completion") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): it("cancelling execution starts sandbox cleanup and observes its completion") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/promise-function-async (#606): it("cancelling execution starts sandbox cleanup and observes its completion") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("cancelling execution starts sandbox cleanup and observes its completion", async () => {
  const execution = Promise.withResolvers<never>();
  const cleanup = Promise.withResolvers<undefined>();
  mocks.javascript.mockReturnValue(execution.promise);
  mocks.cleanup.mockImplementation(() => {
    execution.reject(new Error("Sandbox stopped"));
    return cleanup.promise;
  });
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

  cleanup.resolve(undefined);
  await expect(result).rejects.toBe(controller.signal.reason);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-undefined, typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): it("retains ownership when creation outcome is unknown") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("retains ownership when creation outcome is unknown", async () => {
  const sandboxOwnership = {
    created: vi.fn(() => Promise.resolve()),
    release: vi.fn(() => Promise.resolve()),
    reserve: vi.fn(() => Promise.resolve("reserved-sandbox")),
  };
  mocks.ownership.mockReturnValue(sandboxOwnership);
  mocks.create.mockRejectedValueOnce(new Error("lost create response"));

  await expect(
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling codeExecution.execute; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
    codeExecution.execute?.(
      { code: "source", language: "python", title: "Calculate" },
      testToolContext({ callId: "lost" })
    )
  ).resolves.toMatchObject({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    output: { message: expect.stringContaining("lost create") },
  });
  expect(sandboxOwnership.created).not.toHaveBeenCalled();
  expect(sandboxOwnership.release).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */

it("retains the completed execution charge when its result is invalid", async () => {
  mocks.python.mockResolvedValue({ chart: 42, message: "4" });
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling codeExecution.execute; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
  const result = await codeExecution.execute?.(
    { code: "source", language: "python", title: "Calculate" },
    testToolContext()
  );
  expect(result).toMatchObject({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    output: { message: expect.stringContaining("Sandbox execution failed") },
    usage: { costUsd: 0.05 },
  });
  expect(mocks.cleanup).toHaveBeenCalledOnce();
});
/* oxlint-enable oxc/no-async-await */
