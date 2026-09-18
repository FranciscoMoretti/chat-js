import { beforeEach, expect, test, vi } from "vitest";

import conversation from "../../agent/hooks/conversation";
import instructions from "../../agent/instructions/project";

const mocks = vi.hoisted(() => {
  const state: { content: string | null } = { content: null };
  return {
    checkpoint: vi.fn(),
    project: vi.fn(),
    resolve: vi.fn(),
    state,
  };
});
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
}));

const startTurn = (sequence: number) =>
  conversation.events?.["turn.started"]?.(
    {
      data: { sequence, turnId: `turn_${sequence}` },
      meta: { at: "2026-09-11T12:00:00Z", id: `event_${sequence}` },
      type: "turn.started",
    },
    {
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
            attributes: {},
            authenticator: "test",
            principalId: "owner",
            principalType: "user",
          },
        },
        id: "native-session",
        turn: { id: `turn_${sequence}`, sequence },
      },
    }
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
    expect.any(AbortSignal)
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
