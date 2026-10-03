/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tests/helpers/eve-tool-context"; "../../tools/chatjs/saved-code-execution/execute" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { beforeEach, expect, it, vi } from "vitest";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { executeEveCodeDocument } from "../../tools/chatjs/saved-code-execution/execute";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

const mocks = vi.hoisted(() => ({
  code: true,
  execute: vi.fn(),
  execution: true,
  read: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("@/tools/chatjs/installed-features", () => ({
  installedDocumentKinds: { has: (): boolean => mocks.code },
  installedToolNames: {
    has: (name: string): boolean =>
      name === "runCodeDocument" && mocks.execution,
  },
}));

vi.mock("../db/eve-documents", () => ({ getEveDocumentRevision: mocks.read }));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));
vi.mock("../../tools/chatjs/code-executor", () => ({
  codeExecutor: mocks.execute,
}));

vi.mock("./turn-tools", () => ({ eveToolAllowed: (): boolean => true }));

const input = {
  documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
  revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
};
const revision = {
  content: "print(42)",
  documentId: input.documentId,
  id: input.revisionId,
  kind: "code",
  title: "saved.py",
};
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): context preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const context = testToolContext({
  abortSignal: new AbortController().signal,
  callId: "run-code",
  session: {
    auth: {
      current: null,
      initiator: {
        attributes: {},
        authenticator: "test",
        principalId: "owner",
        principalType: "user",
      },
    },
    id: "native-session",
    turn: { id: "turn", sequence: 1 },
  },
});
/* oxlint-enable unicorn/no-null */

beforeEach(() => {
  vi.resetAllMocks();
  mocks.code = true;
  mocks.execution = true;
  mocks.resolve.mockResolvedValue({
    conversationId: "conversation",
    ownerId: "owner",
  });
  mocks.read.mockResolvedValue(revision);
  mocks.execute.mockResolvedValue({
    kind: "chatjs.tool-result",
    output: { chart: "", message: "42" },
    status: "success",
    usage: { costUsd: 0.05 },
    version: 1,
  });
});

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("executes only the owned saved revision and preserves its billing receipt") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("executes only the owned saved revision and preserves its billing receipt") copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("executes only the owned saved revision and preserves its billing receipt", async () => {
  const result = await executeEveCodeDocument(
    { ...input, code: "malicious replacement", ownerId: "other" },
    context
  ).next();
  expect(mocks.resolve).toHaveBeenCalledWith(
    "owner",
    "native-session",
    context.abortSignal
  );
  expect(mocks.read).toHaveBeenCalledWith(
    "owner",
    "conversation",
    input.documentId,
    input.revisionId
  );
  expect(mocks.execute).toHaveBeenCalledWith(
    { code: "print(42)", language: "python", title: "saved.py" },
    {
      abortSignal: context.abortSignal,
      callId: context.callId,
      session: context.session,
    }
  );
  expect(result.value).toMatchObject({
    output: { ...input, code: "print(42)", message: "42" },
    usage: { costUsd: 0.05 },
  });
});
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable no-undefined, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types --
 * no-undefined (#519): it.each([ undefined, { ...revision, kind: "text" }, { ...revision, title: "unsupporte uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it.each([ undefined, { ...revision, kind: "text" }, { ...revision, title: "unsupporte sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it.each([ undefined, { ...revision, kind: "text" }, { ...revision, title: "unsupporte copies or separates ...revision while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): it.each([ undefined, { ...revision, kind: "text" }, { ...revision, title: "unsupporte accepts value; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it.each([
  undefined,
  { ...revision, kind: "text" },
  { ...revision, title: "unsupported.ts" },
])(
  "rejects unavailable or unsupported revisions before sandbox execution",
  async (value) => {
    mocks.read.mockResolvedValue(value);
    await expect(
      executeEveCodeDocument(input, context).next()
    ).rejects.toThrow();
    expect(mocks.execute).not.toHaveBeenCalled();
  }
);
/* oxlint-enable no-undefined, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("does not execute when cancelled during revision lookup") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("does not execute when cancelled during revision lookup") copies or separates ...context while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("does not execute when cancelled during revision lookup", async () => {
  const cancellation = new AbortController();
  mocks.read.mockImplementation(() => {
    cancellation.abort();
    return revision;
  });
  await expect(
    executeEveCodeDocument(input, {
      ...context,
      abortSignal: cancellation.signal,
    }).next()
  ).rejects.toThrow();
  expect(mocks.execute).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("retains a charged receipt when sandbox chart output is malformed") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("retains a charged receipt when sandbox chart output is malformed") copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("retains a charged receipt when sandbox chart output is malformed", async () => {
  mocks.execute.mockResolvedValue({
    kind: "chatjs.tool-result",
    output: { chart: { elements: [], type: "pie" }, message: "Executed" },
    status: "success",
    usage: { costUsd: 0.05 },
    version: 1,
  });
  const result = await executeEveCodeDocument(input, context).next();
  expect(result.value).toMatchObject({
    output: {
      ...input,
      chart: "",
      message: "Execution finished, but its output has an unsupported format.",
    },
    usage: { costUsd: 0.05 },
  });
});
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it.each(["code", "execution"])("enforces the %s installation requirement before acces sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it.each(["code", "execution"])(
  "enforces the %s installation requirement before accessing documents",
  async (gate) => {
    if (gate === "code") {
      mocks.code = false;
    }
    if (gate === "execution") {
      mocks.execution = false;
    }
    await expect(executeEveCodeDocument(input, context).next()).rejects.toThrow(
      "disabled"
    );
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  }
);
/* oxlint-enable oxc/no-async-await */
