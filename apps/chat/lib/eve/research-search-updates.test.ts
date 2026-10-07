/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tests/helpers/eve-tool-context" dependency within this package instead of introducing an alias or barrel API.
 */
import type { WorkflowToolContext } from "eve/tools";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import { researchSearchUpdates } from "@/tools/chatjs/deep-research/search-updates";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createToolResult } from "./tool-result";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const mocks = vi.hoisted(() => ({ attach: vi.fn(), snapshot: vi.fn() }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./connection-options")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = { attach: mocks.attach };
  },
}));

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep child's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const child = (callId: string, turnId = "turn", name = "researcher") => ({
  data: { callId, childSessionId: callId, name, turnId },
  type: "subagent.called",
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable max-lines-per-function, no-magic-numbers, unicorn/no-null --
 * max-lines-per-function (#510): it("restores actual search evidence only from researchers owned by this call and turn keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("restores actual search evidence only from researchers owned by this call and turn uses 0.05 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): it("restores actual search evidence only from researchers owned by this call and turn preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("restores actual search evidence only from researchers owned by this call and turn", async () => {
  const context: WorkflowToolContext = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing testToolContext({       callId: "research",       session: {         auth: {           current: null,           initiator: {             attributes: {},             authenticator: "test",             principalId: "owner",             principalType: "user",           },         },         id: "root",         turn: { id: "turn", sequence: 1 },       },     }) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...testToolContext({
      callId: "research",
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
        id: "root",
        turn: { id: "turn", sequence: 1 },
      },
    }),
    agent: vi.fn(),
    agents: {},
    ask: vi.fn(),
  };
  const update = {
    queries: ["evidence"],
    results: [
      {
        content: "Evidence",
        source: "web",
        title: "Source",
        url: "https://example.com",
      },
    ],
    status: "completed",
    title: "Search complete",
    toolCallId: "search",
    type: "web",
  };
  mocks.attach.mockReturnValue({ snapshot: mocks.snapshot });
  mocks.snapshot
    .mockResolvedValueOnce({
      events: [
        child("research:one"),
        child("other:two"),
        child("research:old", "old-turn"),
        child("research:planner", "turn", "researchPlanner"),
      ],
    })
    .mockResolvedValueOnce({
      events: [
        { data: {}, type: "action.partial" },
        {
          data: {
            result: {
              kind: "tool-result",
              output: createToolResult({}, 0.05, [update, { malformed: true }]),
            },
          },
          type: "action.result",
        },
      ],
    });
  await expect(researchSearchUpdates(context)).resolves.toEqual([update]);
  expect(mocks.attach.mock.calls).toEqual([["root"], ["research:one"]]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, no-magic-numbers, unicorn/no-null */
