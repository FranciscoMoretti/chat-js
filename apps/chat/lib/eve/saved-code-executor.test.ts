import { beforeEach, expect, test, vi } from "vitest";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { executeEveCodeDocument } from "../../tools/chatjs/saved-code-execution/execute";
import type { CodeExecutor } from "./code-executor";

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
  get codeExecutor() {
    return mocks.settings.installed ? mocks.execute : undefined;
  },
}));
vi.mock("@/tools/chatjs/installed-features", () => ({
  installedDocumentKinds: { has: () => mocks.settings.documentInstalled },
  installedToolNames: {
    has: (name: string) =>
      name === "runCodeDocument" && mocks.settings.toolInstalled,
  },
}));
vi.mock("../db/eve-documents", () => ({ getEveDocumentRevision: mocks.read }));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.scope,
}));
vi.mock("./turn-tools", () => ({
  eveToolAllowed: () => mocks.settings.allowed,
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
  await expect(
    Array.fromAsync(executeEveCodeDocument(input, testToolContext()))
  ).rejects.toThrow();
  expect(mocks.execute).not.toHaveBeenCalled();
});

test("never executes a revision outside the resolved conversation", async () => {
  mocks.read.mockResolvedValue(undefined);
  await expect(
    Array.fromAsync(executeEveCodeDocument(input, testToolContext()))
  ).rejects.toThrow("Code document not found");
  expect(mocks.execute).not.toHaveBeenCalled();
});

test("cancellation prevents execution and an error receipt is forwarded once", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    Array.fromAsync(
      executeEveCodeDocument(
        input,
        testToolContext({ abortSignal: controller.signal })
      )
    )
  ).rejects.toThrow();
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
  expect(
    await Array.fromAsync(executeEveCodeDocument(input, testToolContext()))
  ).toEqual([receipt]);
});
