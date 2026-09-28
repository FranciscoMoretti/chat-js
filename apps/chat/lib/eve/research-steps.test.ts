import type { WorkflowToolContext } from "eve/tools";
import { beforeEach, expect, it, vi } from "vitest";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { prepareResearch, saveResearchReport } from "./research-steps";

const mocks = vi.hoisted(() => ({
  features: {
    deepResearch: { enabled: true },
    documents: { enabled: true, types: { text: true } },
    webSearch: { enabled: true },
  },
  save: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("../config", () => ({ config: { ai: { tools: mocks.features } } }));
vi.mock("../../tools/chatjs/tools", () => ({ tools: { webSearch: {} } }));
vi.mock("../../tools/platform/deep-research/configuration", () => ({
  getDeepResearchConfig: () => ({}),
}));
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
vi.mock("./document-tools", () => ({ executeEveDocumentTool: mocks.save }));
vi.mock("eve/client", () => ({
  Client: class {
    sessions = { attach: () => ({ snapshot: mocks.snapshot }) };
  },
}));
vi.mock("./shared-messages", () => ({
  sharedEveMessages: () => [
    { parts: [{ text: "Research this", type: "text" }], role: "user" },
    {
      parts: [
        {
          toolCallId: "research-call",
          toolName: "deepResearch",
          type: "dynamic-tool",
        },
      ],
      role: "assistant",
    },
  ],
}));
const owner = {
  attributes: {},
  authenticator: "test",
  principalId: "owner",
  principalType: "user",
};
const context = (): WorkflowToolContext => ({
  ...testToolContext({
    callId: "research-call",
    session: {
      auth: { current: owner, initiator: owner },
      id: "root",
      turn: { id: "turn_1", sequence: 1 },
    },
  }),
  agent: vi.fn(),
  agents: {},
  ask: vi.fn(),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.features.deepResearch.enabled = true;
  mocks.features.documents.types.text = true;
  mocks.features.webSearch.enabled = true;
  mocks.snapshot.mockResolvedValue({ events: [] });
});

it("uses the owned native transcript without feeding the live research invocation back into the brief", async () => {
  const prepared = await prepareResearch(context());
  expect(prepared.messages).toContain("Research this");
  expect(prepared.messages).not.toContain("research-call");
  expect(prepared.timestamp).toBeGreaterThan(0);
});

it("rejects disabled research and text documents before reading the transcript", async () => {
  mocks.features.deepResearch.enabled = false;
  await expect(prepareResearch(context())).rejects.toThrow(
    "enabled text documents"
  );
  mocks.features.deepResearch.enabled = true;
  mocks.features.documents.types.text = false;
  await expect(prepareResearch(context())).rejects.toThrow(
    "enabled text documents"
  );

  expect(mocks.snapshot).not.toHaveBeenCalled();
});

it("allows installed research search when standalone search is disabled", async () => {
  mocks.features.webSearch.enabled = false;
  await expect(prepareResearch(context())).resolves.toMatchObject({ messages: expect.stringContaining("Research this") });
});

it("rejects guest and incompatible selected-tool invocations", async () => {
  const ctx = context();
  await expect(
    prepareResearch({
      ...ctx,
      session: {
        ...ctx.session,
        auth: {
          current: owner,
          initiator: { ...owner, attributes: { chatjsGuest: "true" } },
        },
      },
    })
  ).rejects.toThrow("authenticated owner");
  await expect(
    prepareResearch({
      ...ctx,
      session: {
        ...ctx.session,
        auth: {
          current: { ...owner, attributes: { selectedTool: "webSearch" } },
          initiator: owner,
        },
      },
    })
  ).rejects.toThrow("authenticated owner");
  expect(mocks.snapshot).not.toHaveBeenCalled();
});

it("does not save after cancellation and retains the root operation identity on success", async () => {
  const ctx = context();
  const abort = new AbortController();
  abort.abort(new Error("Cancelled"));
  await expect(
    saveResearchReport(
      { ...ctx, abortSignal: abort.signal },
      { content: "Content", title: "Report" }
    )
  ).rejects.toThrow("Cancelled");
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.save.mockResolvedValue({
    date: "2026-09-28",
    documentId: "00000000-0000-4000-8000-000000000001",
    kind: "text",
    result: "Saved",
    revisionId: "00000000-0000-4000-8000-000000000002",
    status: "success",
    title: "Report",
  });
  await saveResearchReport(ctx, { content: "Content", title: "Report" });
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith(
    "createTextDocument",
    { content: "Content", fileIds: [], title: "Report" },
    ctx
  );
});
