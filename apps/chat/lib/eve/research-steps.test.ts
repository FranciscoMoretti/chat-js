import type { WorkflowToolContext } from "eve/tools";
import { beforeEach, expect, it, vi } from "vitest";

import {
  prepareResearch,
  saveResearchReport,
} from "@/tools/chatjs/deep-research/steps";

import { testToolContext } from "../../tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({
  research: true,
  save: vi.fn(),
  selected: vi.fn(),
  snapshot: vi.fn(),
  text: true,
  tools: { webSearch: {} },
}));
vi.mock("./turn-tools", () => ({
  eveToolAllowed: () => true,
  eveTurnTool: { get: mocks.selected },
}));
vi.mock("@/tools/chatjs/installed-features", () => ({
  installedDocumentKinds: { has: () => mocks.text },
  installedToolNames: { has: () => mocks.research },
}));
vi.mock("../../tools/chatjs/providers", () => ({
  providers: mocks.tools,
}));
vi.mock("@/tools/chatjs/deep-research/configuration", () => ({
  getDeepResearchConfig: () => ({}),
}));
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
vi.mock("./document-tools", () => ({ executeEveDocumentTool: mocks.save }));
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = { attach: () => ({ snapshot: mocks.snapshot }) };
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
  mocks.selected.mockReturnValue(null);
  mocks.research = true;
  mocks.text = true;
  mocks.tools.webSearch = {};
  mocks.snapshot.mockResolvedValue({ events: [] });
});

it("uses the owned native transcript without feeding the live research invocation back into the brief", async () => {
  const prepared = await prepareResearch(context());
  expect(prepared.messages).toContain("Research this");
  expect(prepared.messages).not.toContain("research-call");
  expect(prepared.timestamp).toBeGreaterThan(0);
});

it("rejects absent research and text documents before reading the transcript", async () => {
  mocks.research = false;
  await expect(prepareResearch(context())).rejects.toThrow(
    "installed text documents"
  );
  mocks.research = true;
  mocks.text = false;
  await expect(prepareResearch(context())).rejects.toThrow(
    "installed text documents"
  );

  expect(mocks.snapshot).not.toHaveBeenCalled();
});

it("rejects research without an installed search provider", async () => {
  Reflect.deleteProperty(mocks.tools, "webSearch");
  await expect(prepareResearch(context())).rejects.toThrow(
    "installed webSearch"
  );
  expect(mocks.snapshot).not.toHaveBeenCalled();
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
  mocks.selected.mockReturnValue("webSearch");
  await expect(
    prepareResearch({
      ...ctx,
      session: {
        ...ctx.session,
        auth: {
          current: { ...owner, attributes: {} },
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
