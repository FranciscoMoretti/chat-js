import { setSharing } from "../plugins/sharing/queries";
import { eveVote } from "../plugins/feedback/feedback-schema";
import { createEveTestSession } from "./eve-native-session.fixture";

import { eq } from "drizzle-orm";
import type { Client, MessageStreamEvent } from "eve/client";
import { afterAll, beforeEach, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  beginEveConversationDeletion,
  createEveConversation,
} from "../lib/db/eve-queries";
import { getEveMessageVotes } from "../plugins/feedback/feedback-queries";
import { eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { voteEveMessage } from "../plugins/feedback/vote-message";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
const native = vi.hoisted(() => ({ attach: vi.fn(), snapshot: vi.fn() }));
vi.mock("eve/client", async (original) => ({
  ...(await original<{ Client: typeof Client }>()),
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
const conversation = async () =>
  await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Question",
    createEveTestSession
  );

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
  await setSharing(owner, row.id, "public");
  expect(await getEveMessageVotes("stranger", row.id)).toEqual([]);
  native.attach.mockClear();
  expect(await voteEveMessage("stranger", input)).toBeNull();
  expect(native.attach).not.toHaveBeenCalled();
});

test("unknown messages and native user messages cannot receive feedback", async () => {
  const row = await conversation();
  await Promise.all(
    ["turn_0:user", "turn_99:assistant"].map(async (messageId) => {
      expect(
        await voteEveMessage(owner, {
          conversationId: row.id,
          messageId,
          type: "up",
        })
      ).toBeNull();
    })
  );
  expect(await getEveMessageVotes(owner, row.id)).toEqual([]);
});
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
