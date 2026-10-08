/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "drizzle-orm" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-deletion"; "../lib/db/eve-queries"; "../lib/db/queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
import { eq } from "drizzle-orm";
/* oxlint-disable eslint/sort-imports -- Keep the type-only client event binding beside the runtime client module contract. */
import type { Client, MessageStreamEvent } from "eve/client";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { afterAll, beforeEach, expect, test, vi } from "vitest";
/* oxlint-enable eslint/sort-imports */

import { db } from "../lib/db/client";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  beginEveConversationDeletion,
  createEveConversation,
  updateEveConversationMetadata,
} from "../lib/db/eve-queries";
/* oxlint-enable eslint/sort-imports */
import { getEveMessageVotes } from "../lib/db/queries";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveVote, user } from "../lib/db/schema";
/* oxlint-enable eslint/sort-imports */
import { env } from "../lib/env";
import { voteEveMessage } from "../lib/eve/vote-message";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

vi.mock("server-only", () => ({}));
const native = vi.hoisted(() => ({ attach: vi.fn(), snapshot: vi.fn() }));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve vi.mock's awaited sequencing and rejected-Promise behavior. */
vi.mock("eve/client", async (original) => ({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing (await original<{ Client: typeof Client }>()) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...(await original<{ Client: typeof Client }>()),
  Client: class {
    public sessions = { attach: native.attach };
  },
}));
/* oxlint-enable oxc/no-async-await */
assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
// oxlint-disable-next-line node/no-top-level-await -- This Bun database suite creates its owner before registering feedback scenarios.
await db.insert(user).values({
  email: `${owner}@test.invalid`,
  id: owner,
  name: "Feedback fixture",
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
afterAll(async () => {
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
/* oxlint-enable oxc/no-async-await */
const events: MessageStreamEvent[] = [
  {
    data: { message: "Question", sequence: 0, turnId: "turn_0" },
    meta: { at: "2026-09-11T00:00:00Z", id: "received" },
    type: "message.received",
  },
  {
    data: {
      finishReason: "stop",
      message: "Answer",
      sequence: 1,
      stepIndex: 0,
      turnId: "turn_0",
    },
    meta: { at: "2026-09-11T00:00:01Z", id: "completed" },
    type: "message.completed",
  },
];
beforeEach(() => {
  native.attach.mockReset().mockReturnValue({ snapshot: native.snapshot });
  native.snapshot.mockReset().mockResolvedValue({ events });
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve conversation's awaited sequencing and rejected-Promise behavior. Native-session fixture resolves crypto.randomUUID() for createEveConversation; synchronous return would fail its create callback contract. */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep conversation's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
async function conversation() {
  return await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Question",
    async () => crypto.randomUUID()
  );
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("native assistant feedback persists, replaces a vote and stays private when shar keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native assistant feedback persists, replaces a vote and stays private when shar uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("native assistant feedback persists, replaces a vote and stays private when shared", async () => {
  const row = await conversation();
  const input: Parameters<typeof voteEveMessage>[1] = {
    conversationId: row.id,
    messageId: "turn_0:assistant",
    type: "up",
  };
  expect(await voteEveMessage(owner, input)).toEqual({
    isUpvoted: true,
    messageId: input.messageId,
  });
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  await voteEveMessage(owner, { ...input, type: "down" });
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  await voteEveMessage(owner, { ...input, type: "down" });
  expect(await getEveMessageVotes(owner, row.id)).toEqual([
    { isUpvoted: false, messageId: input.messageId },
  ]);
  await updateEveConversationMetadata(owner, row.id, { visibility: "public" });
  expect(await getEveMessageVotes("stranger", row.id)).toEqual([]);
  native.attach.mockClear();
  expect(await voteEveMessage("stranger", input)).toBeNull();
  expect(native.attach).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

test("unknown messages and native user messages cannot receive feedback", async () => {
  const row = await conversation();
  for (const messageId of ["turn_0:user", "turn_99:assistant"]) {
    expect(
      await voteEveMessage(owner, {
        conversationId: row.id,
        messageId,
        type: "up",
      })
    ).toBeNull();
  }
  expect(await getEveMessageVotes(owner, row.id)).toEqual([]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("deletion erases existing feedback and rejects a vote whose snapshot finishes af uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("deletion erases existing feedback and rejects a vote whose snapshot finishes after deletion", async () => {
  const row = await conversation();
  const input: Parameters<typeof voteEveMessage>[1] = {
    conversationId: row.id,
    messageId: "turn_0:assistant",
    type: "up",
  };
  await voteEveMessage(owner, input);
  native.snapshot.mockImplementationOnce(async () => {
    await beginEveConversationDeletion(owner, row.id);
    await completeEveConversationDeletion(owner, row.id);
    return { events };
  });
  expect(await voteEveMessage(owner, input)).toBeNull();
  expect(
    await db.select().from(eveVote).where(eq(eveVote.conversationId, row.id))
  ).toEqual([]);
  native.attach.mockClear();
  expect(await voteEveMessage(owner, input)).toBeNull();
  expect(native.attach).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

test("the same native message ID in a different conversation has independent feedback", async () => {
  const first = await conversation();
  const second = await conversation();
  await voteEveMessage(owner, {
    conversationId: first.id,
    messageId: "turn_0:assistant",
    type: "up",
  });
  expect(await getEveMessageVotes(owner, second.id)).toEqual([]);
  await voteEveMessage(owner, {
    conversationId: second.id,
    messageId: "turn_0:assistant",
    type: "down",
  });
  expect(await getEveMessageVotes(owner, first.id)).toEqual([
    { isUpvoted: true, messageId: "turn_0:assistant" },
  ]);
  native.snapshot.mockRejectedValueOnce(
    new Error("Native snapshot unavailable")
  );
  await expect(
    voteEveMessage(owner, {
      conversationId: second.id,
      messageId: "turn_0:assistant",
      type: "up",
    })
  ).rejects.toThrow("Native snapshot unavailable");
  expect(await getEveMessageVotes(owner, second.id)).toEqual([
    { isUpvoted: false, messageId: "turn_0:assistant" },
  ]);
});
/* oxlint-enable oxc/no-async-await */
