import type { WorkflowToolContext } from "eve/tools";
import { expect, it, vi } from "vitest";

import { researchSearchUpdates } from "@/tools/chatjs/deep-research/search-updates";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { createToolResult } from "./tool-result";

const mocks = vi.hoisted(() => ({ attach: vi.fn(), snapshot: vi.fn() }));
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
vi.mock("eve/client", () => ({
  Client: class {
    sessions = { attach: mocks.attach };
  },
}));

const child = (callId: string, turnId = "turn", name = "researcher") => ({
  data: { callId, childSessionId: callId, name, turnId },
  type: "subagent.called",
});

it("restores actual search evidence only from researchers owned by this call and turn", async () => {
  const context: WorkflowToolContext = {
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
