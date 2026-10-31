import type { HookContext } from "eve/hooks";
import { beforeEach, expect, test, vi } from "vitest";

import conversation from "@/plugins/projects/conversation-hook";
import followups from "@/agent/hooks/followup-suggestions";
import instructions from "@/plugins/projects/instructions";

const mocks = vi.hoisted(() => {
  const state: { content: string | null } = { content: null };
  return {
    followups: vi.fn(),
    project: vi.fn(),
    resolve: vi.fn(),
    state,
  };
});
vi.mock("@/plugins/followup-suggestions/generate-suggestions", () => ({
  generateEveFollowupSuggestions: mocks.followups,
}));
vi.mock("eve/context", () => ({
  defineState: <Value>(
    _name: string,
    initial: () => Value
  ): { get: () => Value } => ({ get: initial }),
}));
vi.mock("eve/hooks", () => ({
  defineHook: <Value>(value: Value): Value => value,
}));
vi.mock("eve/instructions", () => ({
  defineDynamic: <Value>(value: Value): Value => value,
  defineInstructions: <Value>(value: Value): Value => value,
}));
vi.mock("@/plugins/projects/instructions-state", () => ({
  projectInstructions: {
    get: (): typeof mocks.state => mocks.state,
    update: (update: () => { content: string | null }): void => {
      mocks.state = update();
    },
  },
}));
vi.mock("@/lib/eve/conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));
vi.mock("@/plugins/projects/db/project-queries", () => ({
  getEveConversationProject: mocks.project,
}));

const hookContext = (
  sequence: number,
  parent?: HookContext["session"]["parent"]
): HookContext => ({
  agent: { name: "chatjs" },
  channel: {},
  cancel: (): never => {
    throw new Error("Unexpected cancellation");
  },
  getSandbox: (): never => {
    throw new Error("Unexpected sandbox access");
  },
  session: {
    auth: {
      current: null,
      initiator: {
        attributes: { chatjsReservationId: "inherited-reservation" },
        authenticator: "chatjs-gateway",
        principalId: "owner",
        principalType: "user",
      },
    },
    id: "native-session",
    parent,
    turn: { id: `turn_${sequence}`, sequence },
  },
});

const startTurn = async (
  sequence: number,
  parent?: HookContext["session"]["parent"]
) =>
  await conversation.events?.["turn.started"]?.(
    {
      data: { sequence, turnId: `turn_${sequence}` },
      meta: { at: "2026-09-11T12:00:00Z", id: `event_${sequence}` },
      type: "turn.started",
    },
    hookContext(sequence, parent)
  );

const readInstructions = ():
  | ReturnType<NonNullable<(typeof instructions.events)["turn.started"]>>
  | undefined =>
  instructions.events["turn.started"]?.(
    {},
    {
      channel: {},
      messages: [],
      model: null,
      session: {
        auth: {
          current: null,
          initiator: {
            authenticator: "chatjs-gateway",
            attributes: {},
            principalId: "owner",
            principalType: "user",
          },
        },
        id: "native-session",
      },
    }
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.state.content = null;
  mocks.resolve.mockResolvedValue({
    conversationId: "conversation",
    ownerId: "owner",
  });
});

test("refreshes project instructions for each turn and clears them after detachment", async () => {
  mocks.project.mockResolvedValueOnce({ instructions: "First instruction" });
  await startTurn(0);
  expect(mocks.resolve).toHaveBeenCalledWith(
    "owner",
    "native-session",
    expect.any(AbortSignal),
    "inherited-reservation"
  );
  expect(mocks.project).toHaveBeenCalledWith("owner", "conversation");
  expect(readInstructions()).toEqual({
    content: "Project instructions:\nFirst instruction",
  });
  mocks.project.mockResolvedValueOnce({ instructions: "Edited instruction" });
  await startTurn(1);
  expect(readInstructions()).toEqual({
    content: "Project instructions:\nEdited instruction",
  });
  mocks.project.mockResolvedValueOnce(null);
  await startTurn(2);
  expect(readInstructions()).toBeNull();
});

test("propagates required context failures and removes the previous turn's instructions", async () => {
  mocks.state.content = "Stale instructions";
  mocks.project.mockRejectedValueOnce(new Error("Database unavailable"));
  await expect(startTurn(1)).rejects.toThrow("Database unavailable");
  expect(readInstructions()).toBeNull();
  mocks.resolve.mockRejectedValueOnce(new Error("Unbound session"));
  await expect(startTurn(2)).rejects.toThrow("Unbound session");
  expect(mocks.project).toHaveBeenCalledTimes(1);
});

// A nested child must use the root branch, not the immediate parent's session.
test("loads root project context for descendants", async () => {
  mocks.project.mockResolvedValueOnce({
    instructions: "Root project instruction",
  });
  await startTurn(0, {
    callId: "child-call",
    rootSessionId: "root-native",
    sessionId: "intermediate-child",
    turn: { id: "turn_7", sequence: 7 },
  });
  expect(mocks.resolve).toHaveBeenCalledWith(
    "owner",
    "root-native",
    expect.any(AbortSignal),
    undefined
  );
  expect(readInstructions()).toEqual({
    content: "Project instructions:\nRoot project instruction",
  });
});

test("generates user follow-up suggestions only for the root session", async () => {
  await followups.events?.["turn.completed"]?.(
    {
      data: { sequence: 0, turnId: "turn_0" },
      meta: { at: "2026-09-11T12:00:00Z", id: "completed-child" },
      type: "turn.completed",
    },
    hookContext(0, {
      callId: "child-call",
      rootSessionId: "root-native",
      sessionId: "root-native",
      turn: { id: "turn_7", sequence: 7 },
    })
  );
  expect(mocks.followups).not.toHaveBeenCalled();
  await followups.events?.["turn.completed"]?.(
    {
      data: { sequence: 0, turnId: "turn_0" },
      meta: { at: "2026-09-11T12:00:00Z", id: "completed-root" },
      type: "turn.completed",
    },
    hookContext(0)
  );
  expect(mocks.followups).toHaveBeenCalledTimes(1);
});
