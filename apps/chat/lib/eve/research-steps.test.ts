import type { WorkflowToolContext } from "eve/tools";
import type { executeEveDocumentTool } from "./document-tools";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  prepareResearch,
  saveResearchReport,
} from "@/tools/chatjs/deep-research/steps";

import { testToolContext } from "../../tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({
  research: true,
  save: vi.fn<typeof executeEveDocumentTool>(),
  selected: vi.fn(),
  snapshot: vi.fn(),
  text: true,
  tools: { webSearch: {} },
}));

vi.mock("./turn-tools", () => ({
  eveTurnAccount: { get: (): boolean => true },
  eveTurnTool: { get: mocks.selected },
}));

vi.mock("@/chatjs/generated/installed-tools", () => ({
  installedDocumentKinds: { has: (): boolean => mocks.text },
  installedToolNames: { has: (): boolean => mocks.research },
}));

vi.mock("../../chatjs/generated/providers", () => ({
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
  authenticator: "chatjs-gateway",
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
afterEach(() => {
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockReset();
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
          initiator: { ...owner, authenticator: "chatjs-disposable-guest" },
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

it("the durable save records completion only after the document write resolves", async () => {
  const write =
    Promise.withResolvers<Awaited<ReturnType<typeof executeEveDocumentTool>>>();
  mocks.save.mockReturnValue(write.promise);
  const now = vi.spyOn(Date, "now").mockReturnValue(100);
  const ctx = context();
  const report = { content: "# Evidence", title: "Report" };
  const pending = saveResearchReport(ctx, report);
  expect(now).not.toHaveBeenCalled();
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith(
    "createTextDocument",
    { ...report, fileIds: [] },
    ctx
  );
  const document: Awaited<ReturnType<typeof saveResearchReport>>["document"] = {
    date: "2026-10-13",
    documentId: crypto.randomUUID(),
    kind: "text",
    result: "Saved",
    revisionId: crypto.randomUUID(),
    status: "success",
    title: "Report",
  };
  now.mockReturnValue(200);
  write.resolve(document);
  expect(await pending).toEqual({ document, completedAt: 200 });
  expect(now).toHaveBeenCalledOnce();
});

it("a failed save cannot record successful research completion", async () => {
  const error = new Error("Storage unavailable");
  mocks.save.mockRejectedValue(error);
  const now = vi.spyOn(Date, "now");
  await expect(
    saveResearchReport(context(), {
      content: "Evidence",
      title: "Report",
    })
  ).rejects.toBe(error);
  expect(now).not.toHaveBeenCalled();
});
