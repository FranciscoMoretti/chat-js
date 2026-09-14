import { describe, expect, it } from "vitest";

import { resolveEveResponseGroupLineage } from "./response-group-lineage";
import type { EveResponseGroupLineageConversation } from "./response-group-lineage";

const row = (
  id: string,
  operationId: string,
  overrides: Partial<EveResponseGroupLineageConversation> = {}
): EveResponseGroupLineageConversation => ({
  createdAt: new Date(id.length * 1000),
  forkKind: null,
  forkMessageId: null,
  forkTurnId: null,
  id,
  operationId,
  parentConversationId: null,
  sessionId: `session-${id}`,
  ...overrides,
});

describe("response group lineage", () => {
  const group = {
    candidateOperationIds: ["operation-a", "operation-b"],
    id: "group",
  };

  it("uses the latest same-turn regeneration for other slots and the selected retry for its slot", () => {
    const conversations = [
      row("a", "operation-a"),
      row("b", "operation-b"),
      row("a-new", "regenerate-a", {
        createdAt: new Date("2026-01-02"),
        forkKind: "regenerate",
        forkTurnId: "turn_0",
        parentConversationId: "a",
      }),
      row("a-newest", "regenerate-a-again", {
        createdAt: new Date("2026-01-03"),
        forkKind: "regenerate",
        forkTurnId: "turn_0",
        parentConversationId: "a-new",
      }),
    ];
    const fromOtherSlot = resolveEveResponseGroupLineage("b", conversations, [
      group,
    ]);
    expect(fromOtherSlot?.replacements.get("operation-a")).toEqual({
      conversationId: "a-newest",
      sessionId: "session-a-newest",
    });
    expect(
      resolveEveResponseGroupLineage("a-new", conversations, [
        group,
      ])?.replacements.get("operation-a")
    ).toEqual({
      conversationId: "a-new",
      sessionId: "session-a-new",
    });
  });

  it("stops at edits and regenerations of a later turn", () => {
    const root = row("root", "operation-a");
    for (const descendant of [
      row("edit", "edit-operation", {
        forkKind: "edit",
        forkTurnId: "turn_0",
        parentConversationId: "root",
      }),
      row("later", "later-operation", {
        forkKind: "regenerate",
        forkTurnId: "turn_1",
        parentConversationId: "root",
      }),
    ]) {
      expect(
        resolveEveResponseGroupLineage(
          descendant.id,
          [root, descendant],
          [group]
        )
      ).toBeUndefined();
    }
  });

  it("maps an imported candidate's response to its local first turn", () => {
    const candidate = row("imported", "operation-a", {
      forkKind: "comparison",
      forkMessageId: "seed_message_2",
      parentConversationId: "copy",
    });
    const copy = row("copy", "copy-operation");
    const regenerated = row("regenerated", "regeneration", {
      forkKind: "regenerate",
      forkTurnId: "turn_0",
      parentConversationId: "imported",
    });
    expect(
      resolveEveResponseGroupLineage(
        regenerated.id,
        [copy, candidate, regenerated],
        [group]
      )?.replacements.get("operation-a")
    ).toEqual({
      conversationId: "regenerated",
      sessionId: "session-regenerated",
    });
  });
});
