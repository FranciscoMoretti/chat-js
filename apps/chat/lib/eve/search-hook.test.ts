import { testHookContext } from "../../tests/helpers/eve-hook-context";
import type { HookContext, HookEvent } from "eve/hooks";
import { beforeEach, expect, it, vi } from "vitest";

import search from "../../agent/hooks/search";
import type { EveSearchText } from "@/chatjs/plugins/search/search-text";

const mocks = vi.hoisted(() => {
  const state: EveSearchText[] = [];
  return {
    index: vi.fn(),
    recover: vi.fn<() => Promise<void>>(),
    recovery: false,
    resolve: vi.fn(),
    state,
  };
});
vi.mock("eve/hooks", () => ({
  defineHook: <Value>(value: Value): Value => value,
}));
vi.mock("eve/context", () => ({
  defineState: (name: string) => {
    if (name === "chatjs.search-recovery") {
      return {
        get: (): boolean => mocks.recovery,
        update: (update: (current: boolean) => boolean): void => {
          mocks.recovery = update(mocks.recovery);
        },
      };
    }
    return {
      get: () => mocks.state,
      update: (
        update: (current: Readonly<EveSearchText[]>) => EveSearchText[]
      ): void => {
        mocks.state = update(mocks.state);
      },
    };
  },
}));
vi.mock("@/chatjs/plugins/search/search-backfill", () => ({
  backfillEveSearchConversation: mocks.recover,
}));
vi.mock("@/chatjs/plugins/search/search-queries", () => ({
  indexEveSearchText: mocks.index,
}));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));

const context: HookContext<"*"> = {
  ...testHookContext(),
  agent: { name: "chatjs" },
  channel: { kind: "http", metadata: {} },
  cancel: (): never => {
    throw new Error("Unexpected cancellation");
  },
  getSandbox: () => {
    throw new Error("Unexpected sandbox access");
  },
  session: {
    auth: {
      current: null,
      initiator: {
        attributes: { chatjsReservationId: "reservation" },
        authenticator: "chatjs-gateway",
        principalId: "owner",
        principalType: "user",
      },
    },
    id: "session",
    turn: { id: "turn_1", sequence: 1 },
  },
};
const restored = {
  data: {
    transcriptSeed: {
      attachments: "channel",
      messages: [
        {
          parts: [{ text: "inherited text", type: "text" }],
          role: "user",
        },
      ],
    },
  },
  type: "session.started",
} satisfies HookEvent;
const started: HookEvent = {
  data: { turnId: "turn_1", cause: { deliveryId: "delivery" }, follows: null },
  type: "turn.started",
};
const dispatch = async (
  event: Readonly<HookEvent>,
  hookContext: Readonly<HookContext<"*">> = context
) => await search.events?.["*"]?.(event, hookContext);
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {
    // Keep expected console output out of the test log.
  });
  mocks.state = [];
  mocks.recovery = false;
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
      data: {
        parts: [{ kind: "text", text: "new text" }],
        deliveryId: "received",
        turnId: "turn_1",
      },
      type: "delivery.consumed",
    })
  ).resolves.toBeUndefined();
  expect(mocks.state).toEqual([{ key: "delivery:received", text: "new text" }]);
  await dispatch(started);
  expect(mocks.index).toHaveBeenLastCalledWith("owner", "branch", [
    { key: "delivery:received", text: "new text" },
  ]);
  expect(mocks.state).toEqual([]);
});
it("bounds failed retries by entry count and records how omitted events can be recovered", async () => {
  mocks.index.mockRejectedValue(new Error("offline"));
  mocks.recover.mockRejectedValue(new Error("offline"));
  for (let index = 0; index < 300; index += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Dispatch 300 successive outage events against one recovery buffer to prove it stays bounded; parallel dispatch would test simultaneous writers instead.
    await dispatch({
      data: {
        parts: [{ kind: "text", text: "retry text" }],
        deliveryId: String(index),
        turnId: "turn_1",
      },
      type: "delivery.consumed",
    });
  }
  expect(mocks.state).toHaveLength(256);
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining("snapshot recovery queued"),
    { omitted: 1, sessionId: "session" }
  );
  expect(mocks.recovery).toBe(true);
  mocks.recover.mockResolvedValue();
  await dispatch(started);
  expect(mocks.recover).toHaveBeenLastCalledWith("owner", "branch", "session");
  expect(mocks.state).toEqual([]);
  expect(mocks.recovery).toBe(false);
});

it("bounds pending text size and deduplicates replayed history", async () => {
  const oversized: HookEvent = {
    ...restored,
    data: {
      transcriptSeed: {
        attachments: "channel",
        messages: [
          {
            parts: [{ text: "x".repeat(256_001), type: "text" }],
            role: "user",
          },
        ],
      },
    },
  };
  await dispatch(oversized);
  expect(mocks.state).toEqual([]);
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining("snapshot recovery queued"),
    { omitted: 1, sessionId: "session" }
  );
  await dispatch(restored);
  await dispatch(restored);
  expect(mocks.state).toHaveLength(1);
});

it("automatically recovers a large restored history and the next message on a healthy database", async () => {
  await dispatch({
    ...restored,
    data: {
      transcriptSeed: {
        attachments: "channel",
        messages: Array.from({ length: 300 }, (_, index) => ({
          parts: [{ text: `restored ${index}`, type: "text" }],
          role: "user",
        })),
      },
    },
  });
  expect(mocks.state).toHaveLength(256);
  expect(mocks.recover).not.toHaveBeenCalled();
  await dispatch({
    data: {
      parts: [{ kind: "text", text: "new message after history" }],
      deliveryId: "new-message",
      turnId: "turn_1",
    },
    type: "delivery.consumed",
  });
  expect(mocks.recover).toHaveBeenCalledWith("owner", "branch", "session");
  expect(mocks.state).toEqual([]);
  expect(mocks.recovery).toBe(false);
});
