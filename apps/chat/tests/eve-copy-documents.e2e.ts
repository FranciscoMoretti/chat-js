/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { db } from "../lib/db/client";
import { snapshotPublicEveCopyDocuments } from "../lib/db/eve-copy-documents";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
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
  email: `${ownerId}@test.invalid`,
  id: ownerId,
  name: "Copy documents fixture",
});
await db.insert(eveConversation).values([
  {
    firstMessage: "Published",
    id: conversationId,
    operationId: crypto.randomUUID(),
    ownerId,
    sessionId,
    state: "bound",
    visibility: "public",
  },
  {
    firstMessage: "Private branch",
    forkTurnId: "turn_1",
    id: branchId,
    operationId: crypto.randomUUID(),
    ownerId,
    parentConversationId: conversationId,
    rootConversationId: conversationId,
    sessionId: crypto.randomUUID(),
    state: "bound",
  },
]);
const revision = {
  conversationId,
  documentId,
  kind: "text",
  ownerId,
  title: "Published artifact",
  turnIndex: 3,
} satisfies Partial<typeof eveDocumentRevision.$inferInsert>;
await db.insert(eveDocumentRevision).values({
  ...revision,
  content: "First published version",
  id: rootRevision,
  operationId: "root",
});
await db.insert(eveDocumentRevision).values([
  {
    ...revision,
    content: "Second published version",
    id: visibleRevision,
    operationId: "visible",
    parentRevisionId: rootRevision,
  },
  {
    ...revision,
    content: "Private branch secret",
    conversationId: branchId,
    id: privateRevision,
    operationId: "private",
    parentRevisionId: rootRevision,
  },
  {
    ...revision,
    content: "Unpublished document secret",
    documentId: hiddenDocumentId,
    id: hiddenRevision,
    operationId: "hidden",
  },
]);
await db.insert(eveDocumentHead).values([
  { conversationId, documentId, ownerId, revisionId: visibleRevision },
  {
    conversationId: branchId,
    documentId,
    ownerId,
    revisionId: privateRevision,
  },
  {
    conversationId,
    documentId: hiddenDocumentId,
    ownerId,
    revisionId: hiddenRevision,
  },
]);
afterAll(async () => {
  for (const table of [
    eveImportedDocumentCheckpointEntry,
    eveImportedDocumentCheckpoint,
    eveDocumentCheckpointEntry,
    eveDocumentCheckpoint,
  ]) {
    await db.delete(table).where(eq(table.ownerId, ownerId));
  }
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
    resources,
    []
  );
  expect(result.documents).toHaveLength(1);
  expect(result.documents[0].headRevisionId).toBe(visibleRevision);
  expect(result.documents[0].revisions.map((row) => row.id)).toEqual([
    rootRevision,
    visibleRevision,
  ]);
  expect(result.documents[0].revisions.map((row) => row.content)).toEqual([
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
    snapshotPublicEveCopyDocuments(
      conversationId,
      sessionId,
      {
        ...resources,
        revisionIds: [privateRevision],
      },
      []
    )
  ).rejects.toThrow("outside the accessible");
  await expect(
    snapshotPublicEveCopyDocuments(
      conversationId,
      sessionId,
      {
        documentIds: [crypto.randomUUID()],
        revisionIds: [],
      },
      []
    )
  ).rejects.toThrow("no longer accessible");
  await expect(
    snapshotPublicEveCopyDocuments(
      conversationId,
      crypto.randomUUID(),
      resources,
      []
    )
  ).rejects.toThrow("unavailable");
});

test("requires publication even for an empty resource manifest", async () => {
  await expect(
    snapshotPublicEveCopyDocuments(
      branchId,
      sessionId,
      {
        documentIds: [],
        revisionIds: [],
      },
      []
    )
  ).rejects.toThrow("unavailable");
  expect(
    await snapshotPublicEveCopyDocuments(
      conversationId,
      sessionId,
      {
        documentIds: [],
        revisionIds: [],
      },
      []
    )
  ).toEqual({ checkpoints: [], documents: [] });
});

test("observes revocation committed while preparation is waiting on the source row", async () => {
  const updated = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  const revocation = db.transaction(async (tx) => {
    await tx
      .update(eveConversation)
      .set({ visibility: "private" })
      .where(eq(eveConversation.id, conversationId));
    updated.resolve(undefined);
    await release.promise;
  });
  await updated.promise;
  const snapshot = snapshotPublicEveCopyDocuments(
    conversationId,
    sessionId,
    resources,
    []
  );
  const rejected = expect(snapshot).rejects.toThrow("unavailable");
  release.resolve(undefined);
  await revocation;
  await rejected;
  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, conversationId));
});

test("snapshots native and imported boundaries independently of later document heads", async () => {
  await db.insert(eveDocumentCheckpoint).values([
    { conversationId, ownerId, turnIndex: 0 },
    { conversationId, ownerId, turnIndex: 1 },
  ]);
  await db.insert(eveDocumentCheckpointEntry).values({
    conversationId,
    documentId,
    ownerId,
    revisionId: rootRevision,
    turnIndex: 1,
  });
  await db
    .insert(eveImportedDocumentCheckpoint)
    .values({ conversationId, messageIndex: 2, ownerId });
  await db.insert(eveImportedDocumentCheckpointEntry).values({
    conversationId,
    documentId,
    messageIndex: 2,
    ownerId,
    revisionId: rootRevision,
  });
  const result = await snapshotPublicEveCopyDocuments(
    conversationId,
    sessionId,
    resources,
    [
      { messageIndex: 0, sourceIndex: 0, sourceKind: "turn" },
      { messageIndex: 2, sourceIndex: 1, sourceKind: "turn" },
      { messageIndex: 4, sourceIndex: 2, sourceKind: "imported" },
    ]
  );
  expect(result.documents[0].headRevisionId).toBe(visibleRevision);
  expect(result.checkpoints).toEqual([
    { heads: [], messageIndex: 0 },
    { heads: [{ documentId, revisionId: rootRevision }], messageIndex: 2 },
    { heads: [{ documentId, revisionId: rootRevision }], messageIndex: 4 },
  ]);
  await expect(
    snapshotPublicEveCopyDocuments(conversationId, sessionId, resources, [
      { messageIndex: 6, sourceIndex: 99, sourceKind: "turn" },
    ])
  ).rejects.toThrow("boundary is unavailable");
});
