/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../agent/hooks/conversation"; "../../agent/hooks/followup-suggestions"; "../../agent/instructions/project" dependency within this package instead of introducing an alias or barrel API.
 */
import { beforeEach, expect, test, vi } from "vitest";

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
/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): vi.mock("eve/context") uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/context")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("eve/context", () => ({
  defineState: <T>(_name: string, initial: () => T) => ({ get: initial }),
}));
/* oxlint-enable id-length, typescript/explicit-function-return-type */
/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): vi.mock("eve/hooks") uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/hooks")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("eve/hooks", () => ({ defineHook: <T>(value: T) => value }));
/* oxlint-enable id-length, typescript/explicit-function-return-type */
/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): vi.mock("eve/instructions") uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/instructions")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("eve/instructions", () => ({
  defineDynamic: <T>(value: T) => value,
  defineInstructions: <T>(value: T) => value,
}));
/* oxlint-enable id-length, typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./project-instructions")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("./project-instructions", () => ({
  projectInstructions: {
    get: () => mocks.state,
    update: (update: () => { content: string | null }): void => {
      mocks.state = update();
    },
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */
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

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep hookContext's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): hookContext accepts parent?: { callId: string; rootSessionId: string; sessionId: string; turn: { id: str; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): hookContext preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): startTurn uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep startTurn's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): startTurn accepts parent?: Parameters<typeof hookContext>[1]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): startTurn preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

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
/* oxlint-enable no-magic-numbers */
