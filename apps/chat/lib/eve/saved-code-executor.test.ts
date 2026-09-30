import type { ToolContext } from "eve/tools";
import { beforeEach, expect, test, vi } from "vitest";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { invokeSavedCodeExecutor } from "../../tools/chatjs/saved-code-execution/invoke-executor";

const mocks = await vi.hoisted(async () => {
  const { defineTool } = await import("eve/tools");
  const { z } = await import("zod");
  const settings = {
    allowed: true,
    compatible: true,
    protected: false,
    rootOnly: false,
    transform: false,
  };
  const execute = vi.fn();
  const executor = defineTool({
    get approval() {
      return settings.protected ? () => "user-approval" as const : undefined;
    },
    get availableInSubagents() {
      return !settings.rootOnly;
    },
    description: "Saved-code executor fixture",
    execute: (input, context) => execute(input, context),
    inputSchema: z
      .object({
        code: z.string(),
        language: z.enum(["python", "javascript"]),
        title: z.string(),
      })
      .transform((input) =>
        settings.transform ? { ...input, code: "print('changed')" } : input
      ),
  });
  return { execute, executor, settings };
});
vi.mock("../../tools/chatjs/providers", () => ({
  providers: { codeExecution: mocks.executor },
}));
vi.mock("../../tools/chatjs/code-execution-config", () => ({
  get supportsSavedDocuments() {
    return mocks.settings.compatible;
  },
}));
vi.mock("./turn-tools", () => ({
  eveToolAllowed: () => mocks.settings.allowed,
}));
const input = {
  code: "print(42)",
  language: "python" as const,
  title: "saved.py",
};

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(mocks.settings, {
    allowed: true,
    compatible: true,
    protected: false,
    rootOnly: false,
    transform: false,
  });
  delete mocks.executor.outputSchema;
  mocks.execute.mockResolvedValue({
    kind: "chatjs.tool-result",
    output: { chart: "", message: "42" },
    status: "success",
    usage: { costUsd: 0.05 },
    version: 1,
  });
});

test("invokes the executor once with exact source and preserves its receipt", async () => {
  const outputs = await Array.fromAsync(
    invokeSavedCodeExecutor(input, testToolContext())
  );
  expect(mocks.execute).toHaveBeenCalledOnce();
  expect(mocks.execute).toHaveBeenCalledWith(
    input,
    expect.objectContaining({ callId: "test", toolName: "test" })
  );
  expect(outputs).toHaveLength(1);
  expect(outputs[0]).toMatchObject({ usage: { costUsd: 0.05 } });
});

test("rejects input transformations that alter the saved source before executing", async () => {
  mocks.settings.transform = true;
  await expect(
    Array.fromAsync(invokeSavedCodeExecutor(input, testToolContext()))
  ).rejects.toThrow("exact saved source");
  expect(mocks.execute).not.toHaveBeenCalled();
});

test.each(["allowed", "compatible"] as const)(
  "enforces the %s gate before executing",
  async (gate) => {
    mocks.settings[gate] = false;
    await expect(
      Array.fromAsync(invokeSavedCodeExecutor(input, testToolContext()))
    ).rejects.toThrow();
    expect(mocks.execute).not.toHaveBeenCalled();
  }
);

test("rejects policies requiring independent EVE dispatch", async () => {
  mocks.settings.protected = true;
  await expect(
    Array.fromAsync(invokeSavedCodeExecutor(input, testToolContext()))
  ).rejects.toThrow("approval policies");
  mocks.settings.protected = false;
  mocks.settings.rootOnly = true;
  await expect(
    Array.fromAsync(invokeSavedCodeExecutor(input, testToolContext()))
  ).rejects.toThrow("directly through EVE");
  mocks.settings.rootOnly = false;
  mocks.executor.outputSchema = { type: "object" };
  await expect(
    Array.fromAsync(invokeSavedCodeExecutor(input, testToolContext()))
  ).rejects.toThrow("directly through EVE");
  expect(mocks.execute).not.toHaveBeenCalled();
});

test.each(["getToken", "requireAuth"] as const)(
  "cannot use the parent's %s authorization scope",
  async (accessor) => {
    const auth = vi.fn();
    mocks.execute.mockImplementation((_input: unknown, context: ToolContext) =>
      context[accessor]({ getToken: auth })
    );
    await expect(
      Array.fromAsync(
        invokeSavedCodeExecutor(
          input,
          testToolContext({
            getToken: auth,
            requireAuth: () => {
              throw new Error("Parent auth called");
            },
          })
        )
      )
    ).rejects.toThrow("direct EVE invocation");
    expect(auth).not.toHaveBeenCalled();
  }
);
