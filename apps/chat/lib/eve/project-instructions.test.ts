/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../agent/hooks/conversation"; "../../agent/hooks/followup-suggestions"; "../../agent/instructions/project" dependency within this package instead of introducing an alias or barrel API.
 */
import type { HookContext } from "eve/hooks";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { beforeEach, expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import conversation from "../../agent/hooks/conversation";
import followups from "../../agent/hooks/followup-suggestions";
import instructions from "../../agent/instructions/project";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): mocks preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */
vi.mock("./generate-followup-suggestions", () => ({
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
vi.mock("./project-instructions", () => ({
  projectInstructions: {
    get: (): typeof mocks.state => mocks.state,
    update: (update: () => { content: string | null }): void => {
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

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): hookContext preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const hookContext = (
  sequence: number,
  parent?: HookContext["session"]["parent"]
): HookContext => ({
  agent: { name: "chatjs" },
  channel: {},
  getSandbox: (): never => {
    throw new Error("Unexpected sandbox access");
  },
  getSkill: (): never => {
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
/* oxlint-enable unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type, typescript/promise-function-async --
 * typescript/explicit-function-return-type (#560): Keep startTurn's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): startTurn preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const startTurn = (
  sequence: number,
  parent?: HookContext["session"]["parent"]
) =>
  conversation.events?.["turn.started"]?.(
    {
      data: { sequence, turnId: `turn_${sequence}` },
      meta: { at: "2026-09-11T12:00:00Z", id: `event_${sequence}` },
      type: "turn.started",
    },
    hookContext(sequence, parent)
  );
/* oxlint-enable typescript/explicit-function-return-type, typescript/promise-function-async */

/* oxlint-disable typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep readInstructions's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): readInstructions preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): readInstructions preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/no-null */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): beforeEach preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.state.content = null;
  mocks.resolve.mockResolvedValue({
    conversationId: "conversation",
    ownerId: "owner",
  });
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable max-statements, no-magic-numbers, unicorn/no-null --
 * max-statements (#512): test("refreshes project instructions for each turn and clears them after detachment") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("refreshes project instructions for each turn and clears them after detachment") uses 0, 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): test("refreshes project instructions for each turn and clears them after detachment") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, unicorn/no-null */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("propagates required context failures and removes the previous turn's instructio uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): test("loads root project context for descendants without writing child checkpoints") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("loads root project context for descendants without writing child checkpoints") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("does not project a child's waiting checkpoint into the root branch") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing waiting own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...waiting,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing waiting.data own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("generates user follow-up suggestions only for the root session") uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
