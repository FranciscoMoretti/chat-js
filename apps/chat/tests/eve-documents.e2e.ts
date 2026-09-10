import { and, eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { db } from "../lib/db/client";
import {
  getEveDocumentHistory,
  getEveDocumentRevision,
  initializeEveForkDocuments,
  saveEveDocumentRevision,
} from "../lib/db/eve-documents";
import { createEveConversation } from "../lib/db/eve-queries";
import {
  eveConversation,
  eveDocumentHead,
  eveDocumentRevision,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
const stranger = crypto.randomUUID();
await db.insert(user).values(
  [owner, stranger].map((id) => ({
    id,
    email: `${id}@test.invalid`,
    name: "Artifact fixture",
  }))
);
afterAll(async () => {
  await db.delete(eveDocumentHead).where(eq(eveDocumentHead.ownerId, owner));
  await db
    .delete(eveDocumentRevision)
    .where(eq(eveDocumentRevision.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
  await db.delete(user).where(eq(user.id, stranger));
});

async function conversation() {
  return await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Artifact fixture",
    async () => crypto.randomUUID()
  );
}

function draft(conversationId: string) {
  return {
    ownerId: owner,
    conversationId,
    documentId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    expectedRevisionId: null,
    turnIndex: 0,
    title: "Notes",
    content: "Original",
    kind: "text" as const,
  };
}

test("concurrent replays create one revision and old replays never rewind the head", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const revisions = await Promise.all(
    Array.from({ length: 8 }, () => saveEveDocumentRevision(input))
  );
  expect(new Set(revisions.map((revision) => revision.id)).size).toBe(1);
  const second = await saveEveDocumentRevision({
    ...input,
    operationId: crypto.randomUUID(),
    expectedRevisionId: revisions[0].id,
    turnIndex: 1,
    content: "Updated",
  });
  expect((await saveEveDocumentRevision(input)).id).toBe(revisions[0].id);
  expect(
    (await getEveDocumentHistory(owner, chat.id, input.documentId)).at(-1)?.id
  ).toBe(second.id);
  await expect(
    saveEveDocumentRevision({ ...input, content: "Changed replay" })
  ).rejects.toThrow("replay");
});

test("two distinct saves from the same revision cannot overwrite each other", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  const outcomes = await Promise.allSettled(
    ["A", "B"].map((content) =>
      saveEveDocumentRevision({
        ...input,
        operationId: crypto.randomUUID(),
        expectedRevisionId: first.id,
        content,
      })
    )
  );
  expect(
    outcomes.filter((result) => result.status === "fulfilled")
  ).toHaveLength(1);
  expect(
    outcomes.filter((result) => result.status === "rejected")
  ).toHaveLength(1);
  expect(
    await getEveDocumentHistory(owner, chat.id, input.documentId)
  ).toHaveLength(2);
});

test("artifact reads and updates are scoped to owner and conversation", async () => {
  const chat = await conversation();
  const other = await conversation();
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  expect(
    await getEveDocumentHistory(stranger, chat.id, input.documentId)
  ).toEqual([]);
  expect(
    await getEveDocumentHistory(owner, other.id, input.documentId)
  ).toEqual([]);
  await expect(
    saveEveDocumentRevision({
      ...input,
      ownerId: stranger,
      operationId: crypto.randomUUID(),
      expectedRevisionId: first.id,
    })
  ).rejects.toThrow("not found");
  await expect(
    saveEveDocumentRevision({
      ...input,
      conversationId: other.id,
      operationId: crypto.randomUUID(),
      expectedRevisionId: first.id,
    })
  ).rejects.toThrow("changed");
  await expect(
    db.insert(eveDocumentHead).values({
      conversationId: other.id,
      documentId: input.documentId,
      ownerId: stranger,
      revisionId: first.id,
    })
  ).rejects.toThrow();
});

test("forks select the pre-turn revision and parent and child edits stay independent", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  const parentLater = await saveEveDocumentRevision({
    ...input,
    operationId: crypto.randomUUID(),
    expectedRevisionId: first.id,
    turnIndex: 1,
    content: "Parent after fork point",
  });
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Fork",
    async () => crypto.randomUUID(),
    undefined,
    undefined,
    { conversationId: chat.id, beforeTurnId: "turn_1" }
  );
  expect(
    (await getEveDocumentHistory(owner, child.id, input.documentId)).map(
      (revision) => revision.id
    )
  ).toEqual([first.id]);
  const childEdit = await saveEveDocumentRevision({
    ...input,
    conversationId: child.id,
    operationId: crypto.randomUUID(),
    expectedRevisionId: first.id,
    turnIndex: 1,
    content: "Child",
  });
  await saveEveDocumentRevision({
    ...input,
    operationId: crypto.randomUUID(),
    expectedRevisionId: parentLater.id,
    turnIndex: 2,
    content: "Parent newest",
  });
  await initializeEveForkDocuments(owner, child.id);
  expect(
    (await getEveDocumentHistory(owner, child.id, input.documentId)).at(-1)?.id
  ).toBe(childEdit.id);
  expect(
    (await getEveDocumentRevision(owner, chat.id, input.documentId))?.content
  ).toBe("Parent newest");
  const nested = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Nested",
    async () => crypto.randomUUID(),
    undefined,
    undefined,
    { conversationId: child.id, beforeTurnId: "turn_1" }
  );
  expect(
    (await getEveDocumentHistory(owner, nested.id, input.documentId)).map(
      (revision) => revision.id
    )
  ).toEqual([first.id]);
  expect(
    await db
      .select()
      .from(eveDocumentRevision)
      .where(
        and(
          eq(eveDocumentRevision.ownerId, owner),
          eq(eveDocumentRevision.documentId, input.documentId)
        )
      )
  ).toHaveLength(4);
});

test("history beyond 1000 revisions remains readable and forkable without loading all contents", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  const ids = Array.from({ length: 1000 }, () => crypto.randomUUID());
  await db.insert(eveDocumentRevision).values(
    ids.map((id, index) => ({
      id,
      documentId: input.documentId,
      conversationId: chat.id,
      ownerId: owner,
      operationId: id,
      parentRevisionId: index === 0 ? first.id : ids[index - 1],
      turnIndex: index + 1,
      title: "Long history",
      content: "content remains separately loaded",
      kind: input.kind,
    }))
  );
  const tail = ids.at(-1);
  if (!tail) {
    throw new Error("Missing fixture tail");
  }
  await db
    .update(eveDocumentHead)
    .set({ revisionId: tail })
    .where(
      and(
        eq(eveDocumentHead.conversationId, chat.id),
        eq(eveDocumentHead.documentId, input.documentId)
      )
    );
  const newest = await saveEveDocumentRevision({
    ...input,
    operationId: crypto.randomUUID(),
    expectedRevisionId: tail,
    turnIndex: 1001,
    content: "Newest",
  });
  const history = await getEveDocumentHistory(owner, chat.id, input.documentId);
  expect(history).toHaveLength(1002);
  expect(history.at(-1)?.id).toBe(newest.id);
  expect(history.every((version) => !("content" in version))).toBe(true);
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Long fork",
    async () => crypto.randomUUID(),
    undefined,
    undefined,
    { conversationId: chat.id, beforeTurnId: "turn_500" }
  );
  expect(
    (await getEveDocumentHistory(owner, child.id, input.documentId)).at(-1)?.id
  ).toBe(ids[498]);
  expect(
    await getEveDocumentRevision(owner, child.id, input.documentId, newest.id)
  ).toBeUndefined();
});
