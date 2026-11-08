import type { DynamicModelContext } from "eve";
import { conversationOf } from "eve/client";
import { beforeEach, expect, it, vi } from "vitest";

import {
  observeEveModelAccounting,
  resolveAccountedEveModel,
} from "./model-accounting";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  begin: vi.fn(),
  child: vi.fn(),
  finish: vi.fn(),
  register: vi.fn(),
  resolve: vi.fn(),
  scope: vi.fn(),
}));
vi.mock("eve/context", () => ({
  defineState: <Value>(
    _name: string,
    initial: () => Value
  ): {
    get: () => Value;
    update: (update: (current: Value) => Value) => void;
  } => {
    let value = initial();
    return {
      get: () => value,
      update: (update) => {
        value = update(value);
      },
    };
  },
}));
vi.mock("../db/eve-model-ledger", () => ({
  eveModelLedger: {
    authorize: mocks.authorize,
    begin: mocks.begin,
    finish: mocks.finish,
  },
}));
vi.mock("../db/eve-subagents", () => ({
  getEveSubagent: mocks.child,
  registerEveSubagent: mocks.register,
}));
vi.mock("./model-selection", () => ({ resolveEveModel: mocks.resolve }));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.scope,
}));
const context: DynamicModelContext = {
  channel: { kind: "http", metadata: {} },
  messages: async () => await Promise.resolve([]),
  memo: async (_key, run) =>
    await run({
      idempotencyKey: "test",
      abortSignal: new AbortController().signal,
    }),
  view: conversationOf([]).view,
  now: new Date("2026-11-02T00:00:00Z"),
  turn: null,
  session: {
    auth: {
      current: null,
      initiator: {
        attributes: {},
        authenticator: "mock",
        principalId: "owner",
        principalType: "user",
      },
    },
    id: "root",
  },
};
const resolved = {
  model: {
    doGenerate: vi.fn(
      async () =>
        await Promise.resolve({
          content: [],
          finishReason: { raw: "stop", unified: "stop" as const },
          usage: {
            inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 0, total: 0 },
            outputTokens: { reasoning: 0, text: 0, total: 0 },
          },
          warnings: [],
        })
    ),
    doStream: async (): Promise<never> =>
      await Promise.reject(new Error("Unexpected stream")),
    modelId: "selected",
    provider: "mock",
    specificationVersion: "v4" as const,
    supportedUrls: {},
  },
  modelContextWindowTokens: 1000,
  modelOptions: { providerOptions: {} },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolve.mockResolvedValue(resolved);
  observeEveModelAccounting(
    { data: {}, type: "session.started" },
    { id: "root" }
  );
});

it("binds an active turn to its provider attempt", async () => {
  observeEveModelAccounting(
    { data: { turnId: "turn_1" }, type: "turn.started" },
    { id: "root" }
  );
  const active = await resolveAccountedEveModel("selected", {
    ...context,
    turn: { id: "turn_1", status: "running", input: [] },
  });
  await active.model.doGenerate({ prompt: [] });
  expect(mocks.begin).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerId: "owner",
      sessionId: "root",
      turnId: "turn_1",
    })
  );
});

it("puts manual compaction outside a closed turn in maintenance, never the upcoming turn", async () => {
  observeEveModelAccounting(
    { data: { turnId: "turn_1" }, type: "turn.started" },
    { id: "root" }
  );
  observeEveModelAccounting(
    { data: { turnId: "turn_1" }, type: "turn.settled" },
    { id: "root" }
  );
  const manual = await resolveAccountedEveModel("selected", {
    ...context,
    turn: { id: "turn_2", status: "running", input: [] },
  });
  await manual.model.doGenerate({ prompt: [] });
  expect(mocks.begin).toHaveBeenCalledWith(
    expect.objectContaining({ sessionId: "root" })
  );
  expect(mocks.begin.mock.calls[0]?.[0]).not.toHaveProperty("turnId");
});

it("registers child lineage before invoking the provider", async () => {
  observeEveModelAccounting(
    { data: { turnId: "turn_1" }, type: "turn.started" },
    { id: "child", parent: { sessionId: "root", turn: { id: "turn_7" } } }
  );
  mocks.child.mockResolvedValue({
    rootSessionId: "root",
    rootTurnId: "turn_7",
  });
  const child = await resolveAccountedEveModel("research", {
    ...context,
    turn: { id: "turn_1", status: "running", input: [] },
    session: { ...context.session, id: "child" },
  });
  await child.model.doGenerate({ prompt: [] });
  expect(mocks.register).toHaveBeenCalledWith(
    "owner",
    "root",
    "child",
    "turn_7"
  );
  expect(mocks.scope).not.toHaveBeenCalled();
  expect(mocks.begin).toHaveBeenCalledWith(
    expect.objectContaining({ sessionId: "child", turnId: "turn_1" })
  );
});

it("fails closed before resolving a provider when the lifecycle or ownership binding is missing", async () => {
  await expect(
    resolveAccountedEveModel("selected", {
      ...context,
      session: { ...context.session, id: "unbound" },
    })
  ).rejects.toThrow("lifecycle");
  mocks.scope.mockRejectedValue(new Error("owner mismatch"));
  await expect(resolveAccountedEveModel("selected", context)).rejects.toThrow(
    "owner mismatch"
  );
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.begin).not.toHaveBeenCalled();
});

it("authorizes maintenance without querying prior costs", async () => {
  const manual = await resolveAccountedEveModel("selected", context);
  await manual.model.doGenerate({ prompt: [] });
  expect(mocks.authorize).toHaveBeenCalledOnce();
  expect(mocks.begin).toHaveBeenCalledOnce();
});
