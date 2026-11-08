import type { DynamicContext } from "eve";
import { conversationOf } from "eve/client";

export const testDynamicContext = (
  overrides: Partial<DynamicContext> = {}
): DynamicContext => ({
  channel: { kind: "http", metadata: {} },
  messages: async () => await Promise.resolve([]),
  model: { id: "test/model" },
  now: new Date("2026-11-02T00:00:00Z"),
  view: conversationOf([]).view,
  turn: null,
  memo: async (_key, run) =>
    await run({
      idempotencyKey: "test",
      abortSignal: new AbortController().signal,
    }),
  session: { id: "session", auth: { current: null, initiator: null } },
  ...overrides,
});
