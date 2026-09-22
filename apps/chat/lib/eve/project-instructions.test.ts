import { beforeEach, expect, test, vi } from "vitest";

import conversation from "../../agent/hooks/conversation";
import followups from "../../agent/hooks/followup-suggestions";
import instructions from "../../agent/instructions/project";

const mocks = vi.hoisted(() => {
  const state: { content: string | null } = { content: null };
  return {
    checkpoint: vi.fn(),
    followups: vi.fn(),
    namedCheckpoint: vi.fn(),
    project: vi.fn(),
    resolve: vi.fn(),
    state,
  };
});
vi.mock("./generate-followup-suggestions", () => ({
  generateEveFollowupSuggestions: mocks.followups,
}));
vi.mock("eve/context", () => ({
  defineState: <T>(_name: string, initial: () => T) => ({ get: initial }),
}));
vi.mock("eve/hooks", () => ({ defineHook: <T>(value: T) => value }));
vi.mock("eve/instructions", () => ({
  defineDynamic: <T>(value: T) => value,
  defineInstructions: <T>(value: T) => value,
}));
vi.mock("./project-instructions", () => ({
  projectInstructions: {
    get: () => mocks.state,
    update: (update: () => { content: string | null }) => {
      mocks.state = update();
    },
  },
}));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));
vi.mock("../db/eve-queries", () => ({
  getEveConversationProject: mocks.project,
}));
vi.mock("../db/eve-documents", () => ({
  captureEveDocumentCheckpoint: mocks.checkpoint,
  captureEveNamedDocumentCheckpoint: mocks.namedCheckpoint,
}));

const hookContext = (
  sequence: number,
  parent?: {
    callId: string;
    rootSessionId: string;
    sessionId: string;
    turn: { id: string; sequence: number };
  }
) => ({
  agent: { name: "chatjs" },
  channel: {},
  getSandbox: () => {
    throw new Error("Unexpected sandbox access");
  },
  getSkill: () => {
    throw new Error("Unexpected skill access");
  },
  session: {
    auth: {
      current: null,
      initiator: {
        attributes: { chatjsReservationId: "inherited-reservation" },
        authenticator: "test",
        principalId: "owner",
        principalType: "user",
      },
    },
    id: "native-session",
    parent,
    turn: { id: `turn_${sequence}`, sequence },
  },
});

const startTurn = (
  sequence: number,
  parent?: Parameters<typeof hookContext>[1]
) =>
  conversation.events?.["turn.started"]?.(
    {
      data: { sequence, turnId: `turn_${sequence}` },
      meta: { at: "2026-09-11T12:00:00Z", id: `event_${sequence}` },
      type: "turn.started",
    },
    hookContext(sequence, parent)
  );

const readInstructions = () =>
  instructions.events["turn.started"]?.(
    {},
    {
      channel: {},
      messages: [],
      model: null,
      session: {
        auth: { current: null, initiator: null },
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
  expect(mocks.checkpoint).toHaveBeenCalledWith("owner", "conversation", 0);
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
  expect(mocks.checkpoint).not.toHaveBeenCalled();
  expect(readInstructions()).toBeNull();
  mocks.resolve.mockRejectedValueOnce(new Error("Unbound session"));
  await expect(startTurn(2)).rejects.toThrow("Unbound session");
  expect(mocks.project).toHaveBeenCalledTimes(1);
});

// A nested child must use the root branch, not the immediate parent's session.
test("loads root project context for descendants without writing child checkpoints", async () => {
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
  expect(mocks.checkpoint).not.toHaveBeenCalled();
});

test("does not project a child's waiting checkpoint into the root branch", async () => {
  const waiting = {
    data: {
      checkpoint: { beforeTurnId: "turn_1", checkpointId: "child-checkpoint" },
      continuationToken: "continuation",
    },
    meta: { at: "2026-09-11T12:00:00Z", id: "waiting-event" },
    type: "session.waiting",
  };
  await conversation.events?.["session.waiting"]?.(
    {
      ...waiting,
      data: { ...waiting.data, wait: "next-user-message" },
      type: "session.waiting",
    },
    hookContext(0, {
      callId: "child-call",
      rootSessionId: "root-native",
      sessionId: "root-native",
      turn: { id: "turn_7", sequence: 7 },
    })
  );
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.namedCheckpoint).not.toHaveBeenCalled();
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
