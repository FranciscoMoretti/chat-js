import { describe, expect, it } from "vitest";

import {
  eveUserForkBoundary,
  projectEveMessageSiblingNavigation,
  resolveForkSource,
} from "./fork-source";
import type { EveBranchReference } from "./fork-source";
import {
  finishCreation,
  prepareCreation,
  readCreation,
} from "./pending-create";

describe("fork ancestry and recovery", () => {
  const branches = [
    { forkTurnId: null, id: "root", parentConversationId: null },
    { forkTurnId: "turn_2", id: "child", parentConversationId: "root" },
    { forkTurnId: "turn_4", id: "nested", parentConversationId: "child" },
  ];
  it("finds the checkpoint owner for inherited turns and keeps a replacement turn local", () => {
    expect(resolveForkSource("nested", "turn_1", branches).conversationId).toBe(
      "root"
    );
    expect(resolveForkSource("nested", "turn_2", branches).conversationId).toBe(
      "child"
    );
    expect(resolveForkSource("nested", "turn_4", branches).conversationId).toBe(
      "nested"
    );
    expect(() =>
      resolveForkSource("nested", "turn_1", branches.slice(1))
    ).toThrow("unavailable");
  });
  it("preserves an immutable fork across reload independently of a new-chat draft", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const conversationId = crypto.randomUUID();
    const context = {
      conversationId,
      fork: { beforeTurnId: "turn_2", conversationId: crypto.randomUUID() },
    };
    const fresh = prepareCreation(storage, "owner", "new chat");
    const edit = prepareCreation(
      storage,
      "owner",
      "replacement",
      "model",
      context
    );
    expect(readCreation(storage, "owner", { conversationId })).toEqual(edit);
    expect(
      prepareCreation(storage, "owner", "changed", "other", {
        ...context,
        fork: { ...context.fork, beforeTurnId: "turn_0" },
      })
    ).toEqual(edit);
    expect(readCreation(storage, "owner")).toEqual(fresh);
    expect(readCreation(storage, "other", { conversationId })).toBeUndefined();
    finishCreation(storage, "owner", { conversationId });
    expect(readCreation(storage, "owner", { conversationId })).toBeUndefined();
    expect(readCreation(storage, "owner")).toEqual(fresh);
  });
});

it("isolates project creation recovery from ordinary chats, other projects, and other owners", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const scope = { projectId: crypto.randomUUID() };
  const other = { projectId: crypto.randomUUID() };
  const ordinary = prepareCreation(storage, "owner", "Ordinary");
  const project = prepareCreation(
    storage,
    "owner",
    "Project draft",
    "model",
    scope
  );
  expect(project.projectId).toBe(scope.projectId);
  expect(readCreation(storage, "owner", scope)).toEqual(project);
  expect(
    prepareCreation(storage, "owner", "Edited", "other-model", scope)
  ).toEqual(project);
  expect(readCreation(storage, "owner", other)).toBeUndefined();
  expect(readCreation(storage, "other", scope)).toBeUndefined();
  finishCreation(storage, "owner", scope);
  expect(readCreation(storage, "owner", scope)).toBeUndefined();
  expect(readCreation(storage, "owner")).toEqual(ordinary);
});

it("keeps imported boundaries local to the retained seed in every descendant", () => {
  const branches = [
    { forkTurnId: null, id: "copy", parentConversationId: null },
    { forkTurnId: "turn_1", id: "child", parentConversationId: "copy" },
  ];
  expect(resolveForkSource("child", "seed_message_2", branches)).toEqual({
    beforeMessageId: "seed_message_2",
    conversationId: "child",
  });
  for (const boundary of [
    "seed_message_02",
    "seed_message_10000",
    "message_2",
  ]) {
    expect(() => resolveForkSource("child", boundary, branches)).toThrow(
      "unavailable"
    );
  }
  expect(() =>
    resolveForkSource("missing", "seed_message_2", branches)
  ).toThrow("unavailable");
});

it("enables only durable user-message boundaries", () => {
  expect(eveUserForkBoundary({ id: "seed_message_2", role: "user" })).toBe(
    "seed_message_2"
  );
  expect(
    eveUserForkBoundary({
      id: "native",
      metadata: { turnId: "turn_0" },
      role: "user",
    })
  ).toBe("turn_0");
  expect(
    eveUserForkBoundary({ id: "seed_message_2", role: "assistant" })
  ).toBeUndefined();
  expect(
    eveUserForkBoundary({
      id: "seed_message_2",
      metadata: { optimistic: true },
      role: "user",
    })
  ).toBeUndefined();
  expect(eveUserForkBoundary({ id: "pending", role: "user" })).toBeUndefined();
});

describe("message sibling projection", () => {
  it("combines independent and repeated edits into one ordered sibling row", () => {
    const branches: EveBranchReference[] = [
      { forkTurnId: null, id: "root", parentConversationId: null },
      {
        forkKind: "edit",
        forkTurnId: "turn_2",
        id: "first-edit",
        parentConversationId: "root",
      },
      {
        forkKind: "edit",
        forkTurnId: "turn_2",
        id: "independent-edit",
        parentConversationId: "root",
      },
      {
        forkKind: "edit",
        forkTurnId: "turn_2",
        id: "repeated-edit",
        parentConversationId: "first-edit",
      },
    ];
    const projection = projectEveMessageSiblingNavigation(
      "repeated-edit",
      [
        { id: "user-2", metadata: { turnId: "turn_2" }, role: "user" },
        {
          id: "assistant-2",
          metadata: { turnId: "turn_2" },
          role: "assistant",
        },
      ],
      branches
    );
    expect(projection.get("user-2")).toEqual({
      currentIndex: 3,
      siblings: [
        { conversationId: "root" },
        { conversationId: "first-edit" },
        { conversationId: "independent-edit" },
        { conversationId: "repeated-edit" },
      ],
    });
    expect(projection.has("assistant-2")).toBe(false);
  });

  it("keeps user edits and assistant regenerations on their own message rows", () => {
    const branches: EveBranchReference[] = [
      { forkTurnId: null, id: "root", parentConversationId: null },
      {
        forkKind: "regenerate",
        forkTurnId: "turn_0",
        id: "root-regeneration",
        parentConversationId: "root",
      },
      {
        forkKind: "edit",
        forkTurnId: "turn_0",
        id: "edit",
        parentConversationId: "root",
      },
      {
        forkKind: "regenerate",
        forkTurnId: "turn_0",
        id: "edited-regeneration",
        parentConversationId: "edit",
      },
    ];
    const projection = projectEveMessageSiblingNavigation(
      "edited-regeneration",
      [
        { id: "edited-user", metadata: { turnId: "turn_0" }, role: "user" },
        {
          id: "edited-assistant",
          metadata: { turnId: "turn_0" },
          role: "assistant",
        },
      ],
      branches
    );
    expect(projection.get("edited-user")).toEqual({
      currentIndex: 1,
      siblings: [{ conversationId: "root" }, { conversationId: "edit" }],
    });
    expect(projection.get("edited-assistant")).toEqual({
      currentIndex: 1,
      siblings: [
        { conversationId: "edit" },
        { conversationId: "edited-regeneration" },
      ],
    });
  });

  it("collapses response-group edit candidates and leaves comparisons to cards", () => {
    const editedBranches: EveBranchReference[] = [
      { forkTurnId: null, id: "root", parentConversationId: null },
      ...[1, 2].map((responseGroupIndex): EveBranchReference => ({
        forkKind: "edit",
        forkTurnId: "turn_1",
        id: `edit-candidate-${responseGroupIndex}`,
        parentConversationId: "root",
        responseGroupId: "edited-group",
        responseGroupIndex,
      })),
    ];
    const messages: Parameters<typeof projectEveMessageSiblingNavigation>[1] = [
      { id: "user-1", metadata: { turnId: "turn_1" }, role: "user" },
      {
        id: "assistant-1",
        metadata: { turnId: "turn_1" },
        role: "assistant",
      },
    ];
    expect(
      projectEveMessageSiblingNavigation(
        "edit-candidate-2",
        messages,
        editedBranches
      ).get("user-1")
    ).toEqual({
      currentIndex: 1,
      siblings: [
        { conversationId: "root" },
        { conversationId: "edit-candidate-2" },
      ],
    });

    const comparisonBranches = editedBranches.map(
      (branch): EveBranchReference =>
        branch.id === "root" ? branch : { ...branch, forkKind: "comparison" }
    );
    expect(
      projectEveMessageSiblingNavigation(
        "edit-candidate-2",
        messages,
        comparisonBranches
      ).size
    ).toBe(0);
  });

  it("leaves same-boundary edit-group retries to cards but navigates later turns", () => {
    const branches: EveBranchReference[] = [
      { forkTurnId: null, id: "root", parentConversationId: null },
      {
        forkKind: "edit",
        forkTurnId: "turn_1",
        id: "edit-candidate",
        parentConversationId: "root",
        responseGroupId: "edit-group",
        responseGroupIndex: 1,
      },
      {
        forkKind: "regenerate",
        forkTurnId: "turn_1",
        id: "replacement-retry",
        parentConversationId: "edit-candidate",
      },
      {
        forkKind: "regenerate",
        forkTurnId: "turn_2",
        id: "later-retry",
        parentConversationId: "edit-candidate",
      },
    ];
    const messages: Parameters<typeof projectEveMessageSiblingNavigation>[1] = [
      { id: "edited-user", metadata: { turnId: "turn_1" }, role: "user" },
      {
        id: "edited-assistant",
        metadata: { turnId: "turn_1" },
        role: "assistant",
      },
      { id: "later-user", metadata: { turnId: "turn_2" }, role: "user" },
      {
        id: "later-assistant",
        metadata: { turnId: "turn_2" },
        role: "assistant",
      },
    ];

    const replacementProjection = projectEveMessageSiblingNavigation(
      "replacement-retry",
      messages,
      branches
    );
    expect(replacementProjection.has("edited-assistant")).toBe(false);
    expect(replacementProjection.get("edited-user")).toBeDefined();
    expect(
      projectEveMessageSiblingNavigation("later-retry", messages, branches).get(
        "later-assistant"
      )
    ).toEqual({
      currentIndex: 1,
      siblings: [
        { conversationId: "edit-candidate" },
        { conversationId: "later-retry" },
      ],
    });
  });

  it("keeps an ordinary retry navigable beside an independent comparison", () => {
    const messages: Parameters<typeof projectEveMessageSiblingNavigation>[1] = [
      { id: "user", metadata: { turnId: "turn_0" }, role: "user" },
      {
        id: "assistant",
        metadata: { turnId: "turn_0" },
        role: "assistant",
      },
    ];
    const branches: EveBranchReference[] = [
      { forkTurnId: null, id: "root", parentConversationId: null },
      {
        forkKind: "regenerate",
        forkTurnId: "turn_0",
        id: "retry",
        parentConversationId: "root",
      },
      ...[1, 2].map((responseGroupIndex): EveBranchReference => ({
        forkKind: "comparison",
        forkTurnId: "turn_0",
        id: `comparison-${responseGroupIndex}`,
        parentConversationId: "root",
        responseGroupId: "comparison-group",
        responseGroupIndex,
      })),
      {
        forkKind: "regenerate",
        forkTurnId: "turn_0",
        id: "comparison-1-retry",
        parentConversationId: "comparison-1",
      },
    ];

    expect(
      projectEveMessageSiblingNavigation("retry", messages, branches).get(
        "assistant"
      )
    ).toEqual({
      currentIndex: 1,
      siblings: [
        { conversationId: "root" },
        { conversationId: "retry" },
        { conversationId: "comparison-1" },
      ],
    });
    expect(
      projectEveMessageSiblingNavigation("root", messages, branches).get(
        "assistant"
      )
    ).toEqual({
      currentIndex: 0,
      siblings: [
        { conversationId: "root" },
        { conversationId: "retry" },
        { conversationId: "comparison-1" },
      ],
    });
    expect(
      projectEveMessageSiblingNavigation(
        "comparison-2",
        messages,
        branches
      ).get("assistant")
    ).toEqual({
      currentIndex: 2,
      siblings: [
        { conversationId: "root" },
        { conversationId: "retry" },
        { conversationId: "comparison-2" },
      ],
    });
    expect(
      projectEveMessageSiblingNavigation(
        "comparison-1-retry",
        messages,
        branches
      ).get("assistant")
    ).toEqual({
      currentIndex: 2,
      siblings: [
        { conversationId: "root" },
        { conversationId: "retry" },
        { conversationId: "comparison-1-retry" },
      ],
    });
  });

  it("maps imported edits and their native descendants to the replacement row", () => {
    const branches: EveBranchReference[] = [
      { forkTurnId: null, id: "copy", parentConversationId: null },
      {
        forkKind: "edit",
        forkMessageId: "seed_message_2",
        forkTurnId: null,
        id: "imported-edit",
        parentConversationId: "copy",
      },
      {
        forkKind: "edit",
        forkTurnId: "turn_0",
        id: "native-reedit",
        parentConversationId: "imported-edit",
      },
    ];
    const projection = projectEveMessageSiblingNavigation(
      "native-reedit",
      [
        { id: "seed_message_0", role: "user" },
        { id: "native-user", metadata: { turnId: "turn_0" }, role: "user" },
        {
          id: "native-assistant",
          metadata: { turnId: "turn_0" },
          role: "assistant",
        },
      ],
      branches
    );
    expect(projection.get("native-user")).toEqual({
      currentIndex: 2,
      siblings: [
        { conversationId: "copy" },
        { conversationId: "imported-edit" },
        { conversationId: "native-reedit" },
      ],
    });
  });

  it("does not attach an imported regeneration to a later turn's assistant", () => {
    const projection = projectEveMessageSiblingNavigation(
      "copy",
      [
        { id: "seed_message_2", role: "user" },
        { id: "seed_message_3", role: "user" },
        { id: "seed_message_4", role: "assistant" },
      ],
      [
        { forkTurnId: null, id: "copy", parentConversationId: null },
        {
          forkKind: "regenerate",
          forkMessageId: "seed_message_2",
          forkTurnId: null,
          id: "regeneration",
          parentConversationId: "copy",
        },
      ]
    );
    expect(projection.size).toBe(0);
  });

  it("keeps unknown legacy forks on the user boundary without guessing", () => {
    const projection = projectEveMessageSiblingNavigation(
      "legacy",
      [{ id: "user", metadata: { turnId: "turn_0" }, role: "user" }],
      [
        { forkTurnId: null, id: "root", parentConversationId: null },
        {
          forkKind: null,
          forkTurnId: "turn_0",
          id: "legacy",
          parentConversationId: "root",
        },
      ]
    );
    expect(projection.get("user")?.siblings).toEqual([
      { conversationId: "root" },
      { conversationId: "legacy" },
    ]);
  });
});
