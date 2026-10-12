import { beforeEach, expect, test, vi } from "vitest";
import type { CodeExecutor } from "./code-executor";
import { executeEveCodeDocument } from "@/tools/chatjs/saved-code-execution/execute";
import { testToolContext } from "@/tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({
  execute: vi.fn<CodeExecutor>(),
  read: vi.fn(),
  scope: vi.fn(),
  settings: {
    allowed: true,
    documentInstalled: true,
    installed: true,
    toolInstalled: true,
  },
}));
vi.mock("../../tools/chatjs/code-executor", () => ({
  get codeExecutor(): typeof mocks.execute | undefined {
    if (mocks.settings.installed) {
      return mocks.execute;
    }
    return undefined;
  },
}));

vi.mock("@/tools/chatjs/installed-features", () => ({
  installedDocumentKinds: {
    has: (): boolean => mocks.settings.documentInstalled,
  },
  installedToolNames: {
    has: (name: string): boolean =>
      name === "runCodeDocument" && mocks.settings.toolInstalled,
  },
}));

vi.mock("../db/eve-documents", () => ({ getEveDocumentRevision: mocks.read }));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.scope,
}));

vi.mock("./turn-tools", () => ({
  eveToolAllowed: (): boolean => mocks.settings.allowed,
}));

const input = {
  documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
  revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
};
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(mocks.settings, {
    allowed: true,
    documentInstalled: true,
    installed: true,
    toolInstalled: true,
  });
  mocks.scope.mockResolvedValue({ conversationId: "chat", ownerId: "owner" });
  mocks.read.mockResolvedValue({
    content: "print(42)",
    documentId: input.documentId,
    id: input.revisionId,
    kind: "code",
    title: "saved.py",
  });
  mocks.execute.mockResolvedValue({
    kind: "chatjs.tool-result",
    output: { chart: "", message: "42" },
    status: "success",
    usage: { costUsd: 0.05 },
    version: 1,
  });
});

test("executes owned saved source once, exposing only execution context and preserving the cost receipt", async () => {
  const context = testToolContext();
  const results = await Array.fromAsync(
    executeEveCodeDocument({ ...input, code: "model replacement" }, context)
  );
  expect(mocks.read).toHaveBeenCalledWith(
    "owner",
    "chat",
    input.documentId,
    input.revisionId
  );
  expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(
    { code: "print(42)", language: "python", title: "saved.py" },
    {
      abortSignal: context.abortSignal,
      callId: context.callId,
      session: context.session,
    }
  );
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({
    output: { ...input, code: "print(42)", message: "42" },
    usage: { costUsd: 0.05 },
  });
});

test.each([
  "allowed",
  "documentInstalled",
  "installed",
  "toolInstalled",
] as const)("enforces the %s gate", async (gate) => {
  mocks.settings[gate] = false;
  const execution = executeEveCodeDocument(input, testToolContext());
  await expect(Array.fromAsync(execution)).rejects.toThrow();
  expect(mocks.execute).not.toHaveBeenCalled();
});

test("never executes a revision outside the resolved conversation", async () => {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- This mock represents a value-producing lookup or status API; explicit undefined configures its missing-result branch, not a void completion.
  mocks.read.mockResolvedValue(undefined);
  const execution = executeEveCodeDocument(input, testToolContext());
  await expect(Array.fromAsync(execution)).rejects.toThrow(
    "Code document not found"
  );
  expect(mocks.execute).not.toHaveBeenCalled();
});

test("cancellation prevents execution and an error receipt is forwarded once", async () => {
  const controller = new AbortController();
  controller.abort();
  const execution = executeEveCodeDocument(
    input,
    testToolContext({ abortSignal: controller.signal })
  );
  await expect(Array.fromAsync(execution)).rejects.toThrow();
  expect(mocks.execute).not.toHaveBeenCalled();
  const receipt = {
    error: "Execution failed",
    kind: "chatjs.tool-result",
    output: null,
    status: "error",
    usage: { costUsd: 0 },
    version: 1,
  } as const;
  mocks.execute.mockResolvedValue(receipt);
  const results = await Array.fromAsync(
    executeEveCodeDocument(input, testToolContext())
  );
  expect(results).toEqual([receipt]);
});
