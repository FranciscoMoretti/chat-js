import { describe, expect, it } from "vitest";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable-next-line sort-imports -- Keep Oxfmt type-import groups; their declaration order conflicts with sort-imports. */
import type { EveResponseGroupLineageConversation } from "./response-group-lineage";
import { resolveEveResponseGroupLineage } from "./response-group-lineage";

/* oxlint-disable no-magic-numbers, unicorn/no-null --
 * no-magic-numbers (#517): row uses 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): row preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const row = (
  id: string,
  operationId: string,
  overrides: ReadonlyNativeSurface<
    Partial<EveResponseGroupLineageConversation>
  > = {}
): EveResponseGroupLineageConversation => ({
  createdAt: new Date(id.length * 1000),
  forkKind: null,
  forkMessageId: null,
  forkTurnId: null,
  id,
  operationId,
  parentConversationId: null,
  sessionId: `session-${id}`,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing overrides own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...overrides,
});
/* oxlint-enable no-magic-numbers, unicorn/no-null */

/* oxlint-disable max-lines-per-function --
 * max-lines-per-function (#510): describe("response group lineage") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading replacements from fromOtherSlot; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(fromOtherSlot?.replacements.get("operation-a")).toEqual({
      conversationId: "a-newest",
      sessionId: "session-a-newest",
    });
    expect(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading replacements from resolveEveResponseGroupLineage(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading replacements from resolveEveResponseGroupLineage(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  it("does not treat regenerated imported history as the candidate's native answer", () => {
    const copy = row("copy", "copy-operation");
    const candidate = row("imported", "operation-a", {
      forkKind: "comparison",
      forkMessageId: "seed_message_2",
      parentConversationId: copy.id,
    });
    const prefixRegeneration = row("prefix-regeneration", "retry-prefix", {
      forkKind: "regenerate",
      forkMessageId: "seed_message_2",
      parentConversationId: candidate.id,
    });
    expect(
      resolveEveResponseGroupLineage(
        prefixRegeneration.id,
        [copy, candidate, prefixRegeneration],
        [group]
      )
    ).toBeUndefined();
  });
});
/* oxlint-enable max-lines-per-function */
