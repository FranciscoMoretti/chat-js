/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tests/helpers/eve-tool-context" dependency within this package instead of introducing an alias or barrel API.
 */
import type { WorkflowToolContext } from "eve/tools";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { beforeEach, expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import {
  prepareResearch,
  saveResearchReport,
} from "@/tools/chatjs/deep-research/steps";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
/* oxlint-enable import/no-relative-parent-imports */

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
const context = (): WorkflowToolContext => ({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing testToolContext({     callId: "research-call",     session: {       auth: { current: owner, initiator: owner },       id: "root",       turn: { id: "turn_1", sequence: 1 },     },   }) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("uses the owned native transcript without feeding the live research invocation bac uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("uses the owned native transcript without feeding the live research invocation back into the brief", async () => {
  const prepared = await prepareResearch(context());
  expect(prepared.messages).toContain("Research this");
  expect(prepared.messages).not.toContain("research-call");
  expect(prepared.timestamp).toBeGreaterThan(0);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("rejects research without an installed search provider", async () => {
  Reflect.deleteProperty(mocks.tools, "webSearch");
  await expect(prepareResearch(context())).rejects.toThrow(
    "installed webSearch"
  );
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("rejects guest and incompatible selected-tool invocations", async () => {
  const ctx = context();
  await expect(
    prepareResearch({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing ctx own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...ctx,
      session: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing ctx.session own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...ctx.session,
        auth: {
          current: owner,
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing owner own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          initiator: { ...owner, attributes: { chatjsGuest: "true" } },
        },
      },
    })
  ).rejects.toThrow("authenticated owner");
  mocks.selected.mockReturnValue("webSearch");
  await expect(
    prepareResearch({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing ctx own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...ctx,
      session: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing ctx.session own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...ctx.session,
        auth: {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing owner own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          current: { ...owner, attributes: {} },
          initiator: owner,
        },
      },
    })
  ).rejects.toThrow("authenticated owner");
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("does not save after cancellation and retains the root operation identity on success", async () => {
  const ctx = context();
  const abort = new AbortController();
  abort.abort(new Error("Cancelled"));
  await expect(
    saveResearchReport(
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing ctx own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
