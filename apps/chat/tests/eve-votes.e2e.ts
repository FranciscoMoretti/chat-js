import { reconcileEveWorkspaceTurn } from "../lib/eve/reconcile-workspace-turn";
import { cleanupWorkspaceIfUnused } from "../lib/eve/persistent-sandbox-store";
import { setSharing } from "../chatjs/plugins/sharing/queries";
import { eveVote } from "../chatjs/plugins/feedback/feedback-schema";

import { eq } from "drizzle-orm";
import type { Client, SessionStreamEvent } from "eve/client";
import { afterAll, beforeEach, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  beginEveConversationDeletion,
  createEveConversation,
  getEveConversation,
} from "../lib/db/eve-queries";
import { getEveMessageVotes } from "../chatjs/plugins/feedback/feedback-queries";
import { eveConversation, eveDispatch, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { voteEveMessage } from "../chatjs/plugins/feedback/vote-message";
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
  await db.delete(eveDispatch).where(eq(eveDispatch.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
const events: SessionStreamEvent[] = [
  {
    type: "session.started",
    meta: {
      at: "2026-11-02T00:00:00Z",
      position: { line: 0, index: 0 },
      endOfLine: true,
    },
    data: {
      transcriptSeed: {
        attachments: "channel",
        messages: [
          { role: "user", parts: [{ type: "text", text: "Question" }] },
          { role: "assistant", parts: [{ type: "text", text: "Answer" }] },
        ],
      },
    },
  },

  {
    type: "delivery.consumed",
    data: {
      deliveryId: "fixture-delivery",
      turnId: "fixture-turn",
      parts: [{ kind: "text", text: "Followup" }],
    },
    meta: { at: "2026-11-02T00:00:01Z", position: { line: 1, index: 0 } },
  },
  {
    type: "turn.settled",
    data: { turnId: "fixture-turn", outcome: "completed" },
    meta: { at: "2026-11-02T00:00:02Z", position: { line: 2, index: 0 } },
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
    async () =>
      await Promise.resolve({
        sessionId: crypto.randomUUID(),
        deliveryId: "fixture-delivery",
      })
  );

test("native assistant feedback persists, replaces a vote and stays private when shared", async () => {
  const row = await conversation();
  const input: Parameters<typeof voteEveMessage>[1] = {
    conversationId: row.id,
    messageId: "seed_message_1",
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
    ["seed_message_0", "turn_99:assistant"].map(async (messageId) => {
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
    messageId: "seed_message_1",
    type: "up",
  };
  await voteEveMessage(owner, input);
  await reconcileEveWorkspaceTurn(owner, row.id);
  native.snapshot.mockImplementationOnce(async () => {
    const bound = await getEveConversation(owner, row.id);
    await beginEveConversationDeletion(owner, row.id);
    await cleanupWorkspaceIfUnused(
      owner,
      bound?.workspaceId ?? "missing",
      () => {
        throw new Error("Text-only fixture must not allocate a sandbox");
      }
    );
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
    messageId: "seed_message_1",
    type: "up",
  });
  expect(await getEveMessageVotes(owner, second.id)).toEqual([]);
  await voteEveMessage(owner, {
    conversationId: second.id,
    messageId: "seed_message_1",
    type: "down",
  });
  expect(await getEveMessageVotes(owner, first.id)).toEqual([
    { isUpvoted: true, messageId: "seed_message_1" },
  ]);
  native.snapshot.mockRejectedValueOnce(
    new Error("Native snapshot unavailable")
  );
  await expect(
    voteEveMessage(owner, {
      conversationId: second.id,
      messageId: "seed_message_1",
      type: "up",
    })
  ).rejects.toThrow("Native snapshot unavailable");
  expect(await getEveMessageVotes(owner, second.id)).toEqual([
    { isUpvoted: false, messageId: "seed_message_1" },
  ]);
});
