/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tests/helpers/eve-tool-context" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { WorkflowToolContext } from "eve/tools";
import { beforeEach, expect, it, vi } from "vitest";

import {
  prepareResearch,
  saveResearchReport,
} from "@/tools/chatjs/deep-research/steps";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

const mocks = vi.hoisted(() => ({
  research: true,
  save: vi.fn(),
  selected: vi.fn(),
  snapshot: vi.fn(),
  text: true,
  tools: { webSearch: {} },
}));

vi.mock("./turn-tools", () => ({
  eveToolAllowed: (): boolean => true,
  eveTurnTool: { get: mocks.selected },
}));

vi.mock("@/tools/chatjs/installed-features", () => ({
  installedDocumentKinds: { has: (): boolean => mocks.text },
  installedToolNames: { has: (): boolean => mocks.research },
}));

vi.mock("../../tools/chatjs/providers", () => ({
  providers: mocks.tools,
}));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/tools/chatjs/deep-research/configuration")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/tools/chatjs/deep-research/configuration", () => ({
  getDeepResearchConfig: () => ({}),
}));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./connection-options")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("./document-tools", () => ({ executeEveDocumentTool: mocks.save }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/client")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = { attach: () => ({ snapshot: mocks.snapshot }) };
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./shared-messages")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
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
/* oxlint-enable typescript/explicit-function-return-type */
const owner = {
  attributes: {},
  authenticator: "test",
  principalId: "owner",
  principalType: "user",
};
/* oxlint-disable oxc/no-rest-spread-properties --
 * oxc/no-rest-spread-properties (#543): context copies or separates ...testToolContext({ callId: "research-call", session: { auth: { current: owner, init while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): beforeEach preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
beforeEach(() => {
  vi.clearAllMocks();
  mocks.selected.mockReturnValue(null);
  mocks.research = true;
  mocks.text = true;
  mocks.tools.webSearch = {};
  mocks.snapshot.mockResolvedValue({ events: [] });
});
/* oxlint-enable unicorn/no-null */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): it("uses the owned native transcript without feeding the live research invocation bac uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("uses the owned native transcript without feeding the live research invocation bac sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("uses the owned native transcript without feeding the live research invocation back into the brief", async () => {
  const prepared = await prepareResearch(context());
  expect(prepared.messages).toContain("Research this");
  expect(prepared.messages).not.toContain("research-call");
  expect(prepared.timestamp).toBeGreaterThan(0);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("rejects absent research and text documents before reading the transcript") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("rejects research without an installed search provider") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("rejects research without an installed search provider", async () => {
  Reflect.deleteProperty(mocks.tools, "webSearch");
  await expect(prepareResearch(context())).rejects.toThrow(
    "installed webSearch"
  );
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("rejects guest and incompatible selected-tool invocations") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("rejects guest and incompatible selected-tool invocations") copies or separates ...ctx; ...ctx.session; ...owner while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("does not save after cancellation and retains the root operation identity on succe sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("does not save after cancellation and retains the root operation identity on succe copies or separates ...ctx while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */
