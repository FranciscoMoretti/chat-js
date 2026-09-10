import { and, eq, sql } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { db } from "../lib/db/client";
import {
  getAccessibleEveDocument,
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
import { executeEveDocumentTool } from "../lib/eve/document-tools";
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

test("a document save cancelled while waiting for its lock never writes", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const controller = new AbortController();
  const held = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const lockKey = `eve-document:${chat.id}`;
  const locker = db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
    );
    held.resolve();
    await release.promise;
  });
  await held.promise;
  const saving = Promise.allSettled([
    saveEveDocumentRevision(input, controller.signal),
  ]);
  try {
    await expect
      .poll(async () => {
        const rows = await db.execute(
          sql`select 1 from pg_locks where locktype = 'advisory' and not granted and objid = ((hashtextextended(${lockKey}, 0) & 4294967295)::oid) and classid = (((hashtextextended(${lockKey}, 0) >> 32) & 4294967295)::oid)`
        );
        return rows.length;
      })
      .toBe(1);
    controller.abort();
  } finally {
    controller.abort();
    release.resolve();
    await locker;
    await saving;
  }
  expect((await saving)[0].status).toBe("rejected");
  expect(await getEveDocumentHistory(owner, chat.id, input.documentId)).toEqual(
    []
  );
});

test("document viewing respects visibility, revocation and fork ancestry without exposing storage metadata", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  const later = await saveEveDocumentRevision({
    ...input,
    expectedRevisionId: first.id,
    operationId: crypto.randomUUID(),
    turnIndex: 1,
    content: "Private later version",
  });
  expect(
    await getAccessibleEveDocument(undefined, chat.id, input.documentId)
  ).toBeUndefined();
  expect(
    await getAccessibleEveDocument(stranger, chat.id, input.documentId)
  ).toBeUndefined();
  expect(
    await getAccessibleEveDocument(owner, chat.id, input.documentId)
  ).toMatchObject({ revision: { content: "Private later version" } });
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Public branch",
    async () => crypto.randomUUID(),
    undefined,
    undefined,
    { conversationId: chat.id, beforeTurnId: "turn_1" }
  );
  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, child.id));
  const visible = await getAccessibleEveDocument(
    undefined,
    child.id,
    input.documentId
  );
  expect(visible).toMatchObject({
    revision: { id: first.id, content: "Original" },
  });
  expect(visible?.revision).not.toHaveProperty("ownerId");
  expect(visible?.revision).not.toHaveProperty("operationId");
  expect(visible?.history).toHaveLength(1);
  expect(
    await getAccessibleEveDocument(
      undefined,
      child.id,
      input.documentId,
      later.id
    )
  ).toBeUndefined();
  await db
    .update(eveConversation)
    .set({ visibility: "private" })
    .where(eq(eveConversation.id, child.id));
  expect(
    await getAccessibleEveDocument(undefined, child.id, input.documentId)
  ).toBeUndefined();
});

test("native document calls replay safely and reject stale edits and cross-conversation reads", async () => {
  const chat = await conversation();
  const principal = {
    principalId: owner,
    principalType: "user",
    authenticator: "test",
    attributes: {},
  };
  const context = {
    session: {
      id: chat.sessionId,
      auth: { initiator: principal, current: principal },
      turn: { id: "turn_0", sequence: 0 },
    },
    callId: crypto.randomUUID(),
    abortSignal: new AbortController().signal,
  };
  const input = { title: "Native notes", content: "Original" };
  const [created, replay] = await Promise.all([
    executeEveDocumentTool("createTextDocument", input, context),
    executeEveDocumentTool("createTextDocument", input, context),
  ]);
  expect(replay).toEqual(created);
  const edited = await executeEveDocumentTool(
    "editTextDocument",
    {
      ...input,
      content: "Updated",
      documentId: created.documentId,
      expectedRevisionId: created.revisionId,
    },
    { ...context, callId: crypto.randomUUID() }
  );
  expect(
    await executeEveDocumentTool("createTextDocument", input, context)
  ).toEqual(created);
  expect(
    await executeEveDocumentTool(
      "readDocument",
      { documentId: created.documentId },
      context
    )
  ).toMatchObject({ content: "Updated", revisionId: edited.revisionId });
  await expect(
    executeEveDocumentTool(
      "editTextDocument",
      {
        ...input,
        documentId: created.documentId,
        expectedRevisionId: created.revisionId,
      },
      { ...context, callId: crypto.randomUUID() }
    )
  ).rejects.toThrow("changed");
  const other = await conversation();
  await expect(
    executeEveDocumentTool(
      "readDocument",
      { documentId: created.documentId },
      {
        ...context,
        session: { ...context.session, id: other.sessionId },
      }
    )
  ).rejects.toThrow("not found");
  const cancelled = AbortSignal.abort();
  await expect(
    executeEveDocumentTool("createTextDocument", input, {
      ...context,
      abortSignal: cancelled,
    })
  ).rejects.toThrow();
  expect(
    await getEveDocumentHistory(owner, chat.id, created.documentId)
  ).toHaveLength(2);
});

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
