import type { WorkflowToolContext } from "eve/tools";
import { expect, it, vi } from "vitest";

import { researchSearchUpdates } from "@/chatjs/tools/deep-research/search-updates";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { createToolResult } from "./tool-result";

const mocks = vi.hoisted(() => ({ attach: vi.fn(), snapshot: vi.fn() }));
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = { attach: mocks.attach };
  },
}));

const child = (callId: string, turnId = "turn", name = "researcher") => ({
  data: {
    owner: { callId },
    sessionId: "child",
    name,
    stream: "/eve/v1/session/child/stream",
  },
  scope: { turnId },
  type: "child.opened",
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
        child("research"),
        child("other:two"),
        child("research", "old-turn"),
        child("research", "turn", "researchPlanner"),
        child("research:prefix-lookalike"),
        {
          ...child("research"),
          data: {
            ...child("research").data,
            stream: "https://remote.test/stream",
          },
        },
      ],
    })
    .mockResolvedValueOnce({
      events: [
        { data: {}, type: "call.progress" },
        {
          data: {
            callId: "search",
            outcome: "completed",
            output: createToolResult({}, 0.05, [update, { malformed: true }]),
          },
          type: "call.settled",
        },
      ],
    });
  await expect(researchSearchUpdates(context)).resolves.toEqual([update]);
  expect(mocks.attach.mock.calls).toEqual([["root"], ["child"]]);
});
