import type { DynamicResolveContext } from "eve";
import { beforeEach, expect, it, vi } from "vitest";

import {
  accountEveModel,
  observeEveModelAccounting,
  resolveAccountedEveModel,
} from "./model-accounting";

const mocks = vi.hoisted(() => ({
  assertKnown: vi.fn(),
  authority: vi.fn(),
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
  assertEveModelCostsKnown: mocks.assertKnown,
  eveModelLedger: { begin: mocks.begin, finish: mocks.finish },
  getEveModelAccountingState: mocks.authority,
}));
vi.mock("../db/eve-subagents", () => ({
  getEveSubagent: mocks.child,
  registerEveSubagent: mocks.register,
}));
vi.mock("./model-selection", () => ({ resolveEveModel: mocks.resolve }));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.scope,
}));
const context: DynamicResolveContext = {
  channel: {},
  messages: [],
  model: null,
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
const step = { data: { turnId: "turn_1" }, type: "step.started" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authority.mockResolvedValue("wrapper");
  mocks.resolve.mockResolvedValue(resolved);
  observeEveModelAccounting(
    { data: {}, type: "session.started" },
    { id: "root" }
  );
});

it("binds an active turn and refuses unprepared models", async () => {
  observeEveModelAccounting(
    { data: { turnId: "turn_1" }, type: "turn.started" },
    { id: "root" }
  );
  const active = await resolveAccountedEveModel("selected", step, context);
  await active.model.doGenerate({ prompt: [] });
  expect(mocks.begin).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerId: "owner",
      sessionId: "root",
      turnId: "turn_1",
    })
  );
  mocks.authority.mockResolvedValue("unprepared");
  await expect(
    accountEveModel(resolved, {
      ownerId: "owner",
      sessionId: "root",
      turnId: "turn_1",
    })
  ).rejects.toThrow("preparation");
});

it("puts manual compaction outside a closed turn in maintenance, never the upcoming turn", async () => {
  observeEveModelAccounting(
    { data: { turnId: "turn_1" }, type: "turn.started" },
    { id: "root" }
  );
  observeEveModelAccounting(
    { data: { turnId: "turn_1" }, type: "turn.completed" },
    { id: "root" }
  );
  const manual = await resolveAccountedEveModel(
    "selected",
    { ...step, data: { turnId: "turn_2" } },
    context
  );
  await manual.model.doGenerate({ prompt: [] });
  expect(mocks.begin).toHaveBeenCalledWith(
    expect.objectContaining({ sessionId: "root" })
  );
  expect(mocks.begin.mock.calls[0]?.[0]).not.toHaveProperty("turnId");
});

it("registers child lineage and inherits authority from the root, not inherited auth attributes", async () => {
  observeEveModelAccounting(
    { data: { turnId: "turn_1" }, type: "turn.started" },
    { id: "child", parent: { sessionId: "root", turn: { id: "turn_7" } } }
  );
  mocks.child.mockResolvedValue({
    rootSessionId: "root",
    rootTurnId: "turn_7",
  });
  const child = await resolveAccountedEveModel("research", step, {
    ...context,
    session: { ...context.session, id: "child" },
  });
  await child.model.doGenerate({ prompt: [] });
  expect(mocks.register).toHaveBeenCalledWith(
    "owner",
    "root",
    "child",
    "turn_7"
  );
  expect(mocks.authority).toHaveBeenCalledWith("owner", "root");
  expect(mocks.scope).not.toHaveBeenCalled();
  expect(mocks.begin).toHaveBeenCalledWith(
    expect.objectContaining({ sessionId: "child", turnId: "turn_1" })
  );
});

it("fails closed before resolving a provider when the lifecycle or ownership binding is missing", async () => {
  await expect(
    resolveAccountedEveModel("selected", step, {
      ...context,
      session: { ...context.session, id: "unbound" },
    })
  ).rejects.toThrow("lifecycle");
  mocks.scope.mockRejectedValue(new Error("owner mismatch"));
  await expect(
    resolveAccountedEveModel("selected", step, context)
  ).rejects.toThrow("owner mismatch");
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.begin).not.toHaveBeenCalled();
});

it("refuses pre-cutover paused turns without new lifecycle state", async () => {
  mocks.authority.mockResolvedValue("unprepared");
  await expect(
    resolveAccountedEveModel("selected", step, {
      ...context,
      session: { ...context.session, id: "legacy-paused" },
    })
  ).rejects.toThrow("lifecycle");
  expect(mocks.begin).not.toHaveBeenCalled();
});

it("blocks manual compaction after an unresolved receipt", async () => {
  mocks.assertKnown.mockRejectedValue(
    new Error("provider cost reconciliation")
  );
  await expect(
    resolveAccountedEveModel("selected", step, context)
  ).rejects.toThrow("reconciliation");
  expect(mocks.begin).not.toHaveBeenCalled();
});
