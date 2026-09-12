import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { db } from "../lib/db/client";
import { snapshotPublicEveCopyDocuments } from "../lib/db/eve-copy-documents";
import {
  eveConversation,
  eveDocumentHead,
  eveDocumentRevision,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const ownerId = crypto.randomUUID();
const conversationId = crypto.randomUUID();
const branchId = crypto.randomUUID();
const sessionId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const hiddenDocumentId = crypto.randomUUID();
const rootRevision = crypto.randomUUID();
const visibleRevision = crypto.randomUUID();
const privateRevision = crypto.randomUUID();
const hiddenRevision = crypto.randomUUID();
await db.insert(user).values({
  id: ownerId,
  email: `${ownerId}@test.invalid`,
  name: "Copy documents fixture",
});
await db.insert(eveConversation).values([
  {
    id: conversationId,
    ownerId,
    operationId: crypto.randomUUID(),
    firstMessage: "Published",
    sessionId,
    state: "bound",
    visibility: "public",
  },
  {
    id: branchId,
    ownerId,
    operationId: crypto.randomUUID(),
    firstMessage: "Private branch",
    sessionId: crypto.randomUUID(),
    state: "bound",
    parentConversationId: conversationId,
    rootConversationId: conversationId,
    forkTurnId: "turn_1",
  },
]);
const revision = {
  ownerId,
  documentId,
  conversationId,
  title: "Published artifact",
  kind: "text",
  turnIndex: 3,
} satisfies Partial<typeof eveDocumentRevision.$inferInsert>;
await db.insert(eveDocumentRevision).values({
  ...revision,
  id: rootRevision,
  operationId: "root",
  content: "First published version",
});
await db.insert(eveDocumentRevision).values([
  {
    ...revision,
    id: visibleRevision,
    operationId: "visible",
    parentRevisionId: rootRevision,
    content: "Second published version",
  },
  {
    ...revision,
    conversationId: branchId,
    id: privateRevision,
    operationId: "private",
    parentRevisionId: rootRevision,
    content: "Private branch secret",
  },
  {
    ...revision,
    documentId: hiddenDocumentId,
    id: hiddenRevision,
    operationId: "hidden",
    content: "Unpublished document secret",
  },
]);
await db.insert(eveDocumentHead).values([
  { ownerId, conversationId, documentId, revisionId: visibleRevision },
  {
    ownerId,
    conversationId: branchId,
    documentId,
    revisionId: privateRevision,
  },
  {
    ownerId,
    conversationId,
    documentId: hiddenDocumentId,
    revisionId: hiddenRevision,
  },
]);
afterAll(async () => {
  await db.delete(eveDocumentHead).where(eq(eveDocumentHead.ownerId, ownerId));
  await db
    .delete(eveDocumentRevision)
    .where(eq(eveDocumentRevision.ownerId, ownerId));
  await db
    .delete(eveConversation)
    .where(inArray(eveConversation.id, [branchId, conversationId]));
  await db.delete(user).where(eq(user.id, ownerId));
});
const resources = {
  documentIds: [documentId],
  revisionIds: [rootRevision, visibleRevision],
};

test("captures all accessible ancestors without private branches, unrelated documents, or runtime ownership fields", async () => {
  const result = await snapshotPublicEveCopyDocuments(
    conversationId,
    sessionId,
    resources
  );
  expect(result).toHaveLength(1);
  expect(result[0].headRevisionId).toBe(visibleRevision);
  expect(result[0].revisions.map((row) => row.id)).toEqual([
    rootRevision,
    visibleRevision,
  ]);
  expect(result[0].revisions.map((row) => row.content)).toEqual([
    "First published version",
    "Second published version",
  ]);
  for (const forbidden of [
    privateRevision,
    hiddenDocumentId,
    ownerId,
    "turnIndex",
    "operationId",
    "Private branch secret",
  ]) {
    expect(JSON.stringify(result)).not.toContain(forbidden);
  }
});

test("rejects a referenced private revision or a missing document instead of partially copying", async () => {
  await expect(
    snapshotPublicEveCopyDocuments(conversationId, sessionId, {
      ...resources,
      revisionIds: [privateRevision],
    })
  ).rejects.toThrow("outside the accessible");
  await expect(
    snapshotPublicEveCopyDocuments(conversationId, sessionId, {
      documentIds: [crypto.randomUUID()],
      revisionIds: [],
    })
  ).rejects.toThrow("no longer accessible");
  await expect(
    snapshotPublicEveCopyDocuments(
      conversationId,
      crypto.randomUUID(),
      resources
    )
  ).rejects.toThrow("unavailable");
});

test("requires publication even for an empty resource manifest", async () => {
  await expect(
    snapshotPublicEveCopyDocuments(branchId, sessionId, {
      documentIds: [],
      revisionIds: [],
    })
  ).rejects.toThrow("unavailable");
  expect(
    await snapshotPublicEveCopyDocuments(conversationId, sessionId, {
      documentIds: [],
      revisionIds: [],
    })
  ).toEqual([]);
});

test("observes revocation committed while preparation is waiting on the source row", async () => {
  const updated = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const revocation = db.transaction(async (tx) => {
    await tx
      .update(eveConversation)
      .set({ visibility: "private" })
      .where(eq(eveConversation.id, conversationId));
    updated.resolve();
    await release.promise;
  });
  await updated.promise;
  const snapshot = snapshotPublicEveCopyDocuments(
    conversationId,
    sessionId,
    resources
  );
  const rejected = expect(snapshot).rejects.toThrow("unavailable");
  release.resolve();
  await revocation;
  await rejected;
  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, conversationId));
});
