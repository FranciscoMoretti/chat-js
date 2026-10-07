import type { EveMessage } from "eve/client";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { describe, expect, it } from "vitest";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { LogicalBranch, NativeChatAgent } from "./logical-chat";
/* oxlint-enable sort-imports */
import { LogicalChat, logicalChatBusy } from "./logical-chat";

/* oxlint-disable max-params --
 * max-params (#511): message keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const message = (
  id: string,
  role: EveMessage["role"],
  turnId: string,
  text = id
): EveMessage => ({
  id,
  metadata: { turnId },
  parts: [{ text, type: "text" }],
  role,
});
/* oxlint-enable max-params */
/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): branch accepts extra: Partial<LogicalBranch> = {}; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): branch preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const branch = (
  id: string,
  extra: Partial<LogicalBranch> = {}
): LogicalBranch => ({
  createdAt: "2026-09-20T10:00:00Z",
  forkTurnId: null,
  id,
  initialModelId: "same-model",
  operationId: id,
  parentConversationId: null,
  sessionId: `session-${id}`,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing extra own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...extra,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-undefined (#519): agent uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): agent accepts messages: EveMessage[]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): agent preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const agent = (
  messages: EveMessage[],
  status: NativeChatAgent["status"] = "ready"
): NativeChatAgent => ({
  cancel: () => Promise.reject(new Error("unused")),
  data: { messages },
  error: undefined,
  events: [],
  prewarm: (): Promise<void> => Promise.resolve(),
  reset: (): void => {
    // This test runtime has no resettable external state.
  },
  respond: (): Promise<void> => Promise.resolve(),
  resume: (): Promise<void> => Promise.resolve(),
  send: (): Promise<void> => Promise.resolve(),
  session: undefined,
  status,
});
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
const prefix = [
  message("u1", "user", "turn_0"),
  message("turn_0:assistant", "assistant", "turn_0"),
];
const original = [
  ...prefix,
  message("u2", "user", "turn_1"),
  message("turn_1:assistant", "assistant", "turn_1"),
];
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): describe("logical chat over native sessions") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): describe("logical chat over native sessions") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("logical chat over native sessions") uses 2, 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
describe("logical chat over native sessions", () => {
  it("reconstructs retry aliases and edit siblings independently of replay order", () => {
    const chat = new LogicalChat("chat", "root");
    chat.setBranches([
      branch("root"),
      branch("retry", {
        forkKind: "regenerate",
        forkTurnId: "turn_1",
        parentConversationId: "root",
      }),
      branch("edit", {
        forkKind: "edit",
        forkTurnId: "turn_1",
        parentConversationId: "root",
      }),
    ]);
    chat.observe(
      "retry",
      agent([
        ...prefix,
        message("retry-user", "user", "turn_1"),
        message("turn_1:assistant", "assistant", "turn_1", "retry"),
      ])
    );
    chat.observe(
      "edit",
      agent([
        ...prefix,
        message("edited-user", "user", "turn_1"),
        message("turn_1:assistant", "assistant", "turn_1", "edit"),
      ])
    );
    chat.observe("root", agent(original));
    expect(chat.logicalId("retry", "retry-user")).toBe(
      chat.logicalId("root", "u2")
    );
    expect(chat.logicalId("edit", "edited-user")).not.toBe(
      chat.logicalId("root", "u2")
    );
    expect(chat.siblings("root", "turn_1:assistant").ids).toHaveLength(2);
    expect(chat.siblings("root", "u2").ids).toHaveLength(2);
    chat.selectNode(chat.logicalId("retry", "turn_1:assistant") ?? "missing");
    expect(chat.getSnapshot().conversationId).toBe("retry");
    const reload = new LogicalChat("chat", "retry");
    reload.setBranches(chat.getSnapshot().branches);
    for (const [id, native] of chat.getSnapshot().agents) {
      reload.observe(id, native);
    }
    expect([...reload.getSnapshot().aliases]).toEqual([
      ...chat.getSnapshot().aliases,
    ]);
  });
  it("shares duplicate-model comparison users and isolates background updates", () => {
    const chat = new LogicalChat("chat", "left");
    chat.setBranches([
      branch("left", { responseGroupId: "group", responseGroupIndex: 1 }),
      branch("right", { responseGroupId: "group", responseGroupIndex: 2 }),
    ]);
    chat.observe(
      "right",
      agent(
        [
          message("right-user", "user", "turn_0"),
          message("turn_0:assistant", "assistant", "turn_0"),
        ],
        "streaming"
      )
    );
    chat.observe("left", agent(prefix));
    expect(chat.logicalId("right", "right-user")).toBe(
      chat.logicalId("left", "u1")
    );
    const siblings = chat.siblings("left", "turn_0:assistant");
    expect(siblings.index).toBe(0);
    expect(siblings.ids).toHaveLength(2);
    chat.leave();
    chat.selectNode(siblings.ids[0]);
    chat.observe(
      "right",
      agent(
        [
          message("right-user", "user", "turn_0"),
          message("turn_0:assistant", "assistant", "turn_0", "late"),
        ],
        "streaming"
      )
    );
    expect(chat.getSnapshot().conversationId).toBe("left");
    expect(logicalChatBusy(chat.getSnapshot())).toBe(true);
  });
  it("selects rightmost descendants with atomic path/index publication", () => {
    const chat = new LogicalChat("chat", "root");
    chat.setBranches([
      branch("root"),
      branch("retry", {
        forkKind: "regenerate",
        forkTurnId: "turn_1",
        parentConversationId: "root",
      }),
    ]);
    chat.observe("root", agent(original));
    chat.observe(
      "retry",
      agent([
        ...prefix,
        message("retry-u", "user", "turn_1"),
        message("turn_1:assistant", "assistant", "turn_1"),
        message("u3", "user", "turn_2"),
        message("turn_2:assistant", "assistant", "turn_2"),
      ])
    );
    const unsubscribe = chat.subscribe(() => {
      const snapshot = chat.getSnapshot();
      for (const path of snapshot.paths.values()) {
        for (const id of path) {
          expect(snapshot.nodes.has(id)).toBe(true);
        }
      }
    });
    chat.selectNode(chat.logicalId("root", "u2") ?? "missing");
    expect(chat.getSnapshot().cursorId).toBe(
      chat.logicalId("retry", "turn_2:assistant")
    );
    unsubscribe();
  });
  it("protects canonical writers and rejects unknown prefix identities", () => {
    const chat = new LogicalChat("chat", "root");
    chat.setBranches([
      branch("root"),
      branch("retry", {
        forkKind: "regenerate",
        forkTurnId: "turn_1",
        parentConversationId: "root",
      }),
    ]);
    chat.observe("root", agent(original));
    chat.observe(
      "retry",
      agent([
        message("u1", "user", "turn_0", "corrupt"),
        prefix[1],
        message("ru", "user", "turn_1"),
      ])
    );
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading message from chat.getSnapshot(...).nodes.get(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      chat.getSnapshot().nodes.get(chat.logicalId("root", "u1") ?? "missing")
        ?.message.parts
    ).toEqual(original[0].parts);
    chat.observe(
      "retry",
      agent([
        message("unknown", "user", "turn_0"),
        prefix[1],
        message("ru", "user", "turn_1"),
      ])
    );
    expect(chat.getSnapshot().error).toContain("Unknown inherited");
    expect(chat.getSnapshot().paths.has("retry")).toBe(false);
  });
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

it("keeps a selected retry pending until its assistant binds", () => {
  const chat = new LogicalChat("chat", "root");
  chat.setBranches([
    branch("root"),
    branch("retry", {
      forkKind: "regenerate",
      forkTurnId: "turn_1",
      parentConversationId: "root",
    }),
  ]);
  chat.observe("root", agent(original));
  chat.observe(
    "retry",
    agent([...prefix, message("retry-u", "user", "turn_1")], "streaming")
  );
  chat.selectBranch("retry");
  expect(chat.getSnapshot().conversationId).toBe("root");
  chat.observe(
    "retry",
    agent(
      [
        ...prefix,
        message("retry-u", "user", "turn_1"),
        message("turn_1:assistant", "assistant", "turn_1"),
      ],
      "streaming"
    )
  );
  expect(chat.getSnapshot().conversationId).toBe("retry");
});

it("navigation revokes a delayed pending response without affecting its native observer", () => {
  const chat = new LogicalChat("chat", "root");
  chat.setBranches([
    branch("root"),
    branch("retry", {
      forkKind: "regenerate",
      forkTurnId: "turn_1",
      parentConversationId: "root",
    }),
  ]);
  chat.observe("root", agent(original));
  chat.selectBranch("retry");
  chat.leave();
  chat.selectNode(chat.logicalId("root", "turn_1:assistant") ?? "missing");
  chat.observe(
    "retry",
    agent(
      [
        ...prefix,
        message("retry-u", "user", "turn_1"),
        message("turn_1:assistant", "assistant", "turn_1"),
      ],
      "streaming"
    )
  );
  expect(chat.getSnapshot().conversationId).toBe("root");
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading status from chat.getSnapshot(...).agents.get(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(chat.getSnapshot().agents.get("retry")?.status).toBe("streaming");
});

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("isolates command locks, failures and cancellation generations per execution") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("isolates command locks, failures and cancellation generations per execution", () => {
  const chat = new LogicalChat("chat", "root");
  expect(chat.commands.claim("root")).toBe(true);
  expect(chat.commands.claim("root")).toBe(false);
  expect(chat.commands.claim("other")).toBe(true);
  chat.commands.update("root", {
    cancellation: 1,
    failure: new Error("late failure"),
    pending: false,
  });
  expect(chat.commands.get("other").failure).toBeUndefined();
  expect(chat.commands.get("other").cancellation).toBe(0);
  expect(chat.commands.get("other").pending).toBe(true);
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("registration before the URL transition does not revoke initial follow") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("registration before the URL transition does not revoke initial follow", () => {
  const chat = new LogicalChat("chat", "root");
  chat.setBranches([branch("root")]);
  chat.setVisible(false);
  chat.observe("root", agent([prefix[0]], "streaming"));
  chat.setVisible(true);
  chat.observe("root", agent(prefix));
  expect(chat.getSnapshot().cursorId).toBe(
    chat.logicalId("root", "turn_0:assistant")
  );
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines -- #509: This logical-chat.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
