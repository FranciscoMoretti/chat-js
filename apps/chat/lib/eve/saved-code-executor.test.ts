/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tests/helpers/eve-tool-context"; "../../tools/chatjs/saved-code-execution/execute" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { beforeEach, expect, test, vi } from "vitest";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { executeEveCodeDocument } from "../../tools/chatjs/saved-code-execution/execute";
import type { CodeExecutor } from "./code-executor";
/* oxlint-enable import/no-relative-parent-imports */

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
/* oxlint-disable no-undefined, typescript/explicit-function-return-type  --
 * no-ternary (#518): vi.mock("../../tools/chatjs/code-executor") derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): vi.mock("../../tools/chatjs/code-executor") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("../../tools/chatjs/code-executor")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("../../tools/chatjs/code-executor", () => ({
  get codeExecutor() {
    return mocks.settings.installed ? mocks.execute : undefined;
  },
}));
/* oxlint-enable no-undefined, typescript/explicit-function-return-type */

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

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): test("executes owned saved source once, exposing only execution context and preservin uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("executes owned saved source once, exposing only execution context and preservin sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test("executes owned saved source once, exposing only execution context and preservin copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable unicorn/max-nested-calls  --
 * oxc/no-async-await (#540): test.each([ "allowed", "documentInstalled", "installed", "toolInstalled", ] as const) sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/max-nested-calls (#568): test.each([ "allowed", "documentInstalled", "installed", "toolInstalled", ] as const) keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable no-undefined, unicorn/max-nested-calls  --
 * no-undefined (#519): test("never executes a revision outside the resolved conversation") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("never executes a revision outside the resolved conversation") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/max-nested-calls (#568): test("never executes a revision outside the resolved conversation") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("never executes a revision outside the resolved conversation", async () => {
  mocks.read.mockResolvedValue(undefined);
  await expect(
    Array.fromAsync(executeEveCodeDocument(input, testToolContext()))
  ).rejects.toThrow("Code document not found");
  expect(mocks.execute).not.toHaveBeenCalled();
});
/* oxlint-enable no-undefined, unicorn/max-nested-calls */

/* oxlint-disable unicorn/max-nested-calls, unicorn/no-null  --
 * oxc/no-async-await (#540): test("cancellation prevents execution and an error receipt is forwarded once") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/max-nested-calls (#568): test("cancellation prevents execution and an error receipt is forwarded once") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("cancellation prevents execution and an error receipt is forwarded once") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/max-nested-calls, unicorn/no-null */
