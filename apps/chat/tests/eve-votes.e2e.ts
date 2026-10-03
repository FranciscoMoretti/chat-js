/* oxlint-disable import/max-dependencies, import/no-namespace, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "drizzle-orm" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-namespace (#528): The EveClient namespace is the consumed SDK/module interface; renaming all member references requires changing that import contract.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-deletion"; "../lib/db/eve-queries"; "../lib/db/queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
import { eq } from "drizzle-orm";
import type * as EveClient from "eve/client";
import type { MessageStreamEvent } from "eve/client";
import { afterAll, beforeEach, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  beginEveConversationDeletion,
  createEveConversation,
  updateEveConversationMetadata,
} from "../lib/db/eve-queries";
import { getEveMessageVotes } from "../lib/db/queries";
import { eveConversation, eveVote, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { voteEveMessage } from "../lib/eve/vote-message";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/max-dependencies, import/no-namespace, import/no-relative-parent-imports */

vi.mock("server-only", () => ({}));
const native = vi.hoisted(() => ({ attach: vi.fn(), snapshot: vi.fn() }));
vi.mock("eve/client", async (original) => ({
  ...(await original<typeof EveClient>()),
  Client: class {
    public sessions = { attach: native.attach };
  },
}));

assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
await db.insert(user).values({
  email: `${owner}@test.invalid`,
  id: owner,
  name: "Feedback fixture",
});
afterAll(async () => {
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
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
  await voteEveMessage(owner, { ...input, type: "down" });
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
