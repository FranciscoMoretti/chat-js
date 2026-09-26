import type { HookContext, HookEvent } from "eve/hooks";
import { beforeEach, expect, it, vi } from "vitest";

import search from "../../agent/hooks/search";
import type { EveSearchText } from "./search-text";

const mocks = vi.hoisted(() => {
  const state: EveSearchText[] = [];
  return { index: vi.fn(), resolve: vi.fn(), state };
});
vi.mock("eve/hooks", () => ({ defineHook: <T>(value: T) => value }));
vi.mock("eve/context", () => ({
  defineState: () => ({
    get: () => mocks.state,
    update: (update: (current: EveSearchText[]) => EveSearchText[]) => {
      mocks.state = update(mocks.state);
    },
  }),
}));
vi.mock("../db/eve-search", () => ({ indexEveSearchText: mocks.index }));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));

const context: HookContext = {
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
        attributes: { chatjsReservationId: "reservation" },
        authenticator: "test",
        principalId: "owner",
        principalType: "user",
      },
    },
    id: "session",
    turn: { id: "turn_1", sequence: 1 },
  },
};
const restored: HookEvent = {
  data: {
    messages: [
      {
        id: "seed_message_0",
        parts: [{ text: "inherited text", type: "text" }],
        role: "user",
      },
    ],
  },
  meta: { at: "2026-09-25T10:00:00Z", id: "history" },
  type: "history.seeded",
};
const started: HookEvent = {
  data: { sequence: 1, turnId: "turn_1" },
  meta: restored.meta,
  type: "turn.started",
};
const dispatch = (event: HookEvent, hookContext = context) =>
  search.events?.["*"]?.(event, hookContext);
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.state = [];
  mocks.resolve.mockResolvedValue({
    conversationId: "branch",
    ownerId: "owner",
  });
});
it("defers inherited history until binding and retains it if indexing fails", async () => {
  await dispatch(restored);
  expect(mocks.index).not.toHaveBeenCalled();
  mocks.index.mockRejectedValueOnce(new Error("offline"));
  await expect(dispatch(started)).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalled();
  await dispatch(started);
  expect(mocks.index).toHaveBeenLastCalledWith("owner", "branch", [
    { key: "seed:0", text: "inherited text" },
  ]);
  expect(mocks.state).toEqual([]);
});
it("never indexes subagent-private text into the parent chat", async () => {
  await dispatch(restored, {
    ...context,
    session: {
      ...context.session,
      parent: {
        callId: "call",
        rootSessionId: "root",
        sessionId: "parent",
        turn: { id: "turn_0", sequence: 0 },
      },
    },
  });
  expect(mocks.state).toEqual([]);
  expect(mocks.resolve).not.toHaveBeenCalled();
});

it("does no scope or database work on a turn with no pending text", async () => {
  await dispatch(started);
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.index).not.toHaveBeenCalled();
});

it("retains newly received text when scope resolution fails and retries it", async () => {
  mocks.resolve.mockRejectedValueOnce(new Error("mapping unavailable"));
  await expect(
    dispatch({
      data: { message: "new text", sequence: 1, turnId: "turn_1" },
      meta: { ...restored.meta, id: "received" },
      type: "message.received",
    })
  ).resolves.toBeUndefined();
  expect(mocks.state).toEqual([{ key: "event:received", text: "new text" }]);
  await dispatch(started);
  expect(mocks.index).toHaveBeenLastCalledWith("owner", "branch", [
    { key: "event:received", text: "new text" },
  ]);
  expect(mocks.state).toEqual([]);
});

it("bounds failed retries by entry count and records how omitted events can be recovered", async () => {
  mocks.index.mockRejectedValue(new Error("offline"));
  for (let index = 0; index < 300; index += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Exercise successive events during an outage.
    await dispatch({
      data: { message: "retry text", sequence: index, turnId: "turn_1" },
      meta: { ...restored.meta, id: String(index) },
      type: "message.received",
    });
  }
  expect(mocks.state).toHaveLength(256);
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining("run search:backfill"),
    { omitted: 1, sessionId: "session" }
  );
  mocks.index.mockResolvedValue(undefined);
  await dispatch(started);
  expect(mocks.state).toEqual([]);
});

it("bounds pending text size and deduplicates replayed history", async () => {
  const oversized: HookEvent = {
    ...restored,
    data: {
      messages: [
        {
          id: "seed_message_0",
          parts: [{ text: "x".repeat(256_001), type: "text" }],
          role: "user",
        },
      ],
    },
  };
  await dispatch(oversized);
  expect(mocks.state).toEqual([]);
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining("run search:backfill"),
    { omitted: 1, sessionId: "session" }
  );
  await dispatch(restored);
  await dispatch(restored);
  expect(mocks.state).toHaveLength(1);
});
