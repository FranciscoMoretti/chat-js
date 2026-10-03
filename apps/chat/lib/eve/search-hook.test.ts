/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../agent/hooks/search" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { HookContext, HookEvent } from "eve/hooks";
import { beforeEach, expect, it, vi } from "vitest";

import search from "../../agent/hooks/search";
import type { EveSearchText } from "./search-text";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

const mocks = vi.hoisted(() => {
  const state: EveSearchText[] = [];
  return {
    index: vi.fn(),
    recover: vi.fn(),
    recovery: false,
    resolve: vi.fn(),
    state,
  };
});
/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): vi.mock("eve/hooks") uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/hooks")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("eve/hooks", () => ({ defineHook: <T>(value: T) => value }));
/* oxlint-enable id-length, typescript/explicit-function-return-type */
/* oxlint-disable no-ternary, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * no-ternary (#518): vi.mock("eve/context") derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/context")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): vi.mock("eve/context") accepts current: EveSearchText[]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
vi.mock("eve/context", () => ({
  defineState: (name: string) =>
    name === "chatjs.search-recovery"
      ? {
          get: (): boolean => mocks.recovery,
          update: (update: (current: boolean) => boolean): void => {
            mocks.recovery = update(mocks.recovery);
          },
        }
      : {
          get: () => mocks.state,
          update: (
            update: (current: EveSearchText[]) => EveSearchText[]
          ): void => {
            mocks.state = update(mocks.state);
          },
        },
}));
/* oxlint-enable no-ternary, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
vi.mock("./search-backfill", () => ({
  backfillEveSearchConversation: mocks.recover,
}));
vi.mock("../db/eve-search", () => ({ indexEveSearchText: mocks.index }));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): context preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */
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
/* oxlint-disable oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * oxc/no-optional-chaining (#542): dispatch handles optional search.events?.["*"]?.(event, hookContext) without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep dispatch's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): dispatch accepts event: HookEvent; hookContext = context; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): dispatch preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const dispatch = (event: HookEvent, hookContext = context) =>
  search.events?.["*"]?.(event, hookContext);
/* oxlint-enable oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
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
/* oxlint-disable no-console, oxc/no-async-await --
 * no-console (#514): it("defers inherited history until binding and retains it if indexing fails") emits fixture diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * oxc/no-async-await (#540): it("defers inherited history until binding and retains it if indexing fails") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable no-console, oxc/no-async-await */
/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("never indexes subagent-private text into the parent chat") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("never indexes subagent-private text into the parent chat") copies or separates ...context; ...context.session while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("does no scope or database work on a turn with no pending text") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("does no scope or database work on a turn with no pending text", async () => {
  await dispatch(started);
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.index).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("retains newly received text when scope resolution fails and retries it") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("retains newly received text when scope resolution fails and retries it") copies or separates ...restored.meta while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable max-statements, no-console, no-magic-numbers, no-undefined, oxc/no-async-await, oxc/no-rest-spread-properties --
 * max-statements (#512): it("bounds failed retries by entry count and records how omitted events can be recove keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): it("bounds failed retries by entry count and records how omitted events can be recove emits fixture diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): it("bounds failed retries by entry count and records how omitted events can be recove uses 300, 1, 256 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("bounds failed retries by entry count and records how omitted events can be recove uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("bounds failed retries by entry count and records how omitted events can be recove sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("bounds failed retries by entry count and records how omitted events can be recove copies or separates ...restored.meta while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("bounds failed retries by entry count and records how omitted events can be recovered", async () => {
  mocks.index.mockRejectedValue(new Error("offline"));
  mocks.recover.mockRejectedValue(new Error("offline"));
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
    expect.stringContaining("snapshot recovery queued"),
    { omitted: 1, sessionId: "session" }
  );
  expect(mocks.recovery).toBe(true);
  mocks.recover.mockResolvedValue(undefined);
  await dispatch(started);
  expect(mocks.recover).toHaveBeenLastCalledWith("owner", "branch", "session");
  expect(mocks.state).toEqual([]);
  expect(mocks.recovery).toBe(false);
});
/* oxlint-enable max-statements, no-console, no-magic-numbers, no-undefined, oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable no-console, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties --
 * no-console (#514): it("bounds pending text size and deduplicates replayed history") emits fixture diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): it("bounds pending text size and deduplicates replayed history") uses 256_001, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("bounds pending text size and deduplicates replayed history") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("bounds pending text size and deduplicates replayed history") copies or separates ...restored while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
    expect.stringContaining("snapshot recovery queued"),
    { omitted: 1, sessionId: "session" }
  );
  await dispatch(restored);
  await dispatch(restored);
  expect(mocks.state).toHaveLength(1);
});
/* oxlint-enable no-console, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable id-length, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties --
 * id-length (#506): it("automatically recovers a large restored history and the next message on a healthy uses _ as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-magic-numbers (#517): it("automatically recovers a large restored history and the next message on a healthy uses 256 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("automatically recovers a large restored history and the next message on a healthy sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("automatically recovers a large restored history and the next message on a healthy copies or separates ...restored; ...restored.meta while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("automatically recovers a large restored history and the next message on a healthy database", async () => {
  await dispatch({
    ...restored,
    data: {
      messages: Array.from({ length: 300 }, (_, index) => ({
        id: `seed_message_${index}`,
        parts: [{ text: `restored ${index}`, type: "text" }],
        role: "user",
      })),
    },
  });
  expect(mocks.state).toHaveLength(256);
  expect(mocks.recover).not.toHaveBeenCalled();
  await dispatch({
    data: {
      message: "new message after history",
      sequence: 1,
      turnId: "turn_1",
    },
    meta: { ...restored.meta, id: "new-message" },
    type: "message.received",
  });
  expect(mocks.recover).toHaveBeenCalledWith("owner", "branch", "session");
  expect(mocks.state).toEqual([]);
  expect(mocks.recovery).toBe(false);
});
/* oxlint-enable id-length, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties */
