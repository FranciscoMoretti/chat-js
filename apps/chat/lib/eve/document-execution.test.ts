import { beforeEach, expect, it, vi } from "vitest";

import { executeEveCodeDocument } from "./document-execution";

const mocks = vi.hoisted(() => ({
  documents: { enabled: true, types: { code: true } },
  execute: vi.fn(),
  execution: { enabled: true },
  read: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: { codeExecution: mocks.execution, documents: mocks.documents },
    },
  },
}));
vi.mock("../db/eve-documents", () => ({ getEveDocumentRevision: mocks.read }));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));
vi.mock("./platform-tools", () => ({ executeEvePlatformTool: mocks.execute }));

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
const context = {
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
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.documents.enabled = true;
  mocks.documents.types.code = true;
  mocks.execution.enabled = true;
  mocks.resolve.mockResolvedValue({
    conversationId: "conversation",
    ownerId: "owner",
  });
  mocks.read.mockResolvedValue(revision);
  mocks.execute.mockImplementation(function* fixtureOutput() {
    yield {
      kind: "chatjs.platform-result",
      output: { chart: "", message: "42" },
      usage: { costUsd: 0.05 },
      version: 1,
    };
  });
});

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
    "codeExecution",
    { code: "print(42)", language: "python", title: "saved.py" },
    context,
    []
  );
  expect(result.value).toMatchObject({
    output: { ...input, code: "print(42)", message: "42" },
    usage: { costUsd: 0.05 },
  });
});

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

it("retains a charged receipt when sandbox chart output is malformed", async () => {
  mocks.execute.mockImplementation(function* fixtureOutput() {
    yield {
      kind: "chatjs.platform-result",
      output: { chart: { elements: [], type: "pie" }, message: "Executed" },
      usage: { costUsd: 0.05 },
      version: 1,
    };
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

it.each(["documents", "code", "execution"])(
  "enforces the %s configuration gate before accessing documents",
  async (gate) => {
    if (gate === "documents") {
      mocks.documents.enabled = false;
    }
    if (gate === "code") {
      mocks.documents.types.code = false;
    }
    if (gate === "execution") {
      mocks.execution.enabled = false;
    }
    await expect(executeEveCodeDocument(input, context).next()).rejects.toThrow(
      "disabled"
    );
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  }
);
