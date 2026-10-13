import { readFile, readdir } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import {
  eveChat,
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  user,
} from "./schema";

const postgres = new PGlite();
const database = drizzle(postgres);
const DATABASE_SETUP_TIMEOUT_MS = 30_000;
const FIRST_TURN_INDEX = 0;
const FIRST_INPUT_INDEX = 0;
const NEXT_TURN_INDEX = 1;
const ABSENT_TURN_INDEX = 2;

vi.mock("./client", (): { db: typeof database } => ({ db: database }));
vi.mock("@/lib/env", () => ({ env: {} }));

const {
  captureEveDocumentCheckpoint,
  getEveDocumentRevision,
  initializeEveForkDocuments,
  saveEveDocumentRevision,
} = await import("./eve-documents");

const { snapshotPublicEveCopyDocuments } = await import("./eve-copy-documents");

beforeAll(async (): Promise<void> => {
  const migrationDirectory = new URL("migrations/", import.meta.url);
  const entries = await readdir(migrationDirectory);
  const filenames = entries.filter((name) => name.endsWith(".sql")).toSorted();
  const migrations = await Promise.all(
    filenames.map(
      async (name) => await readFile(new URL(name, migrationDirectory), "utf-8")
    )
  );
  for (const migration of migrations) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Apply each checked-in migration after its predecessor so dependent SQL schema objects exist before the next migration and document fixtures.
    await postgres.exec(migration);
  }
  await database.insert(user).values({
    email: "documents@example.test",
    id: "document-owner",
    name: "Document owner",
  });
}, DATABASE_SETUP_TIMEOUT_MS);

afterAll(async (): Promise<void> => {
  await postgres.close();
});

const seedConversation = async (conversationId: string): Promise<void> => {
  await database.insert(eveChat).values({
    id: conversationId,
    ownerId: "document-owner",
    title: "Documents",
  });
  await database.insert(eveConversation).values({
    chatId: conversationId,
    firstMessage: "Documents",
    id: conversationId,
    operationId: conversationId,
    ownerId: "document-owner",
    sessionId: conversationId,
    state: "bound",
    visibility: "public",
  });
};

type RevisionInput = Parameters<
  typeof saveEveDocumentRevision
>[typeof FIRST_INPUT_INDEX];
const revisionInput = (
  conversationId: string,
  documentId: string,
  title = "Original title"
): RevisionInput => ({
  content: "Original content",
  conversationId,
  documentId,
  expectedRevisionId: null,
  fileIds: [],
  kind: "text",
  operationId: `save:${documentId}`,
  ownerId: "document-owner",
  title,
  turnIndex: FIRST_TURN_INDEX,
});

it("backfills each document's native history before adding a manual revision", async () => {
  const conversationId = crypto.randomUUID();
  await seedConversation(conversationId);
  const first = await saveEveDocumentRevision(
    revisionInput(conversationId, crypto.randomUUID())
  );
  const second = await saveEveDocumentRevision(
    revisionInput(conversationId, crypto.randomUUID())
  );
  await saveEveDocumentRevision(
    {
      ...revisionInput(conversationId, first.documentId),
      expectedRevisionId: first.id,
      operationId: crypto.randomUUID(),
      turnIndex: null,
    },
    undefined,
    [0, 1]
  );
  const checkpoints = await database
    .select()
    .from(eveDocumentCheckpoint)
    .where(eq(eveDocumentCheckpoint.conversationId, conversationId));
  expect(
    checkpoints
      .map((row) => row.turnIndex)
      .toSorted((left, right) => left - right)
  ).toEqual([0, 1]);
  const entries = await database
    .select()
    .from(eveDocumentCheckpointEntry)
    .where(eq(eveDocumentCheckpointEntry.conversationId, conversationId));
  expect(
    entries.map((row) => ({
      documentId: row.documentId,
      revisionId: row.revisionId,
      turnIndex: row.turnIndex,
    }))
  ).toEqual(
    expect.arrayContaining([
      { documentId: first.documentId, revisionId: first.id, turnIndex: 1 },
      { documentId: second.documentId, revisionId: second.id, turnIndex: 1 },
    ])
  );
  expect(entries).toHaveLength(2);
});

it("initializes all legacy fork heads from their pre-turn ancestry", async () => {
  const parentId = crypto.randomUUID();
  const childId = crypto.randomUUID();
  await seedConversation(parentId);
  await seedConversation(childId);
  const first = await saveEveDocumentRevision(
    revisionInput(parentId, crypto.randomUUID())
  );
  const second = await saveEveDocumentRevision(
    revisionInput(parentId, crypto.randomUUID())
  );
  await database
    .update(eveConversation)
    .set({
      chatId: parentId,
      parentConversationId: parentId,
      rootConversationId: parentId,
      forkTurnId: "turn_1",
    })
    .where(eq(eveConversation.id, childId));
  await initializeEveForkDocuments("document-owner", childId);
  const heads = await database
    .select()
    .from(eveDocumentHead)
    .where(eq(eveDocumentHead.conversationId, childId));
  expect(heads.map((row) => row.revisionId)).toEqual(
    expect.arrayContaining([first.id, second.id])
  );
  expect(heads).toHaveLength(2);
  await initializeEveForkDocuments("document-owner", childId);
  const replayed = await database
    .select()
    .from(eveDocumentHead)
    .where(eq(eveDocumentHead.conversationId, childId));
  expect(replayed).toEqual(heads);
});

it("rolls back legacy fork head insertion when any ancestry contains a manual revision", async () => {
  const parentId = crypto.randomUUID();
  const childId = crypto.randomUUID();
  await seedConversation(parentId);
  await seedConversation(childId);
  await saveEveDocumentRevision(revisionInput(parentId, crypto.randomUUID()));
  const manualDocumentId = crypto.randomUUID();
  const manual = await saveEveDocumentRevision(
    revisionInput(parentId, manualDocumentId)
  );
  await saveEveDocumentRevision({
    ...revisionInput(parentId, manualDocumentId),
    expectedRevisionId: manual.id,
    operationId: crypto.randomUUID(),
    turnIndex: NEXT_TURN_INDEX,
  });
  await database
    .update(eveDocumentRevision)
    .set({ turnIndex: null })
    .where(eq(eveDocumentRevision.id, manual.id));
  await database
    .update(eveConversation)
    .set({
      chatId: parentId,
      parentConversationId: parentId,
      rootConversationId: parentId,
      forkTurnId: "turn_1",
    })
    .where(eq(eveConversation.id, childId));
  await expect(
    initializeEveForkDocuments("document-owner", childId)
  ).rejects.toThrow("Document checkpoint is not ready. Retry this fork.");
  const heads = await database
    .select()
    .from(eveDocumentHead)
    .where(eq(eveDocumentHead.conversationId, childId));
  expect(heads).toEqual([]);
});

it("selects the nearest pre-turn legacy revision and omits documents created at the fork boundary", async () => {
  const parentId = crypto.randomUUID();
  const childId = crypto.randomUUID();
  await seedConversation(parentId);
  await seedConversation(childId);
  const documentId = crypto.randomUUID();
  const first = await saveEveDocumentRevision(
    revisionInput(parentId, documentId)
  );
  const selected = await saveEveDocumentRevision({
    ...revisionInput(parentId, documentId),
    expectedRevisionId: first.id,
    operationId: crypto.randomUUID(),
  });
  await saveEveDocumentRevision({
    ...revisionInput(parentId, documentId),
    expectedRevisionId: selected.id,
    operationId: crypto.randomUUID(),
    turnIndex: NEXT_TURN_INDEX,
  });
  await saveEveDocumentRevision({
    ...revisionInput(parentId, crypto.randomUUID()),
    turnIndex: NEXT_TURN_INDEX,
  });
  await database
    .update(eveConversation)
    .set({
      chatId: parentId,
      parentConversationId: parentId,
      rootConversationId: parentId,
      forkTurnId: "turn_1",
    })
    .where(eq(eveConversation.id, childId));

  await initializeEveForkDocuments("document-owner", childId);
  const heads = await database
    .select()
    .from(eveDocumentHead)
    .where(eq(eveDocumentHead.conversationId, childId));
  expect(heads).toEqual([
    expect.objectContaining({ documentId, revisionId: selected.id }),
  ]);
});

it("rejects cyclic legacy ancestry without inserting any fork heads", async () => {
  const parentId = crypto.randomUUID();
  const childId = crypto.randomUUID();
  await seedConversation(parentId);
  await seedConversation(childId);
  const revision = await saveEveDocumentRevision(
    revisionInput(parentId, crypto.randomUUID())
  );
  const head = await saveEveDocumentRevision({
    ...revisionInput(parentId, revision.documentId),
    expectedRevisionId: revision.id,
    operationId: crypto.randomUUID(),
    turnIndex: NEXT_TURN_INDEX,
  });
  await database
    .update(eveDocumentRevision)
    .set({ parentRevisionId: head.id })
    .where(eq(eveDocumentRevision.id, revision.id));
  await database
    .update(eveConversation)
    .set({
      chatId: parentId,
      parentConversationId: parentId,
      rootConversationId: parentId,
      forkTurnId: "turn_1",
    })
    .where(eq(eveConversation.id, childId));

  await expect(
    initializeEveForkDocuments("document-owner", childId)
  ).rejects.toThrow("Document history could not be loaded.");
  const heads = await database
    .select()
    .from(eveDocumentHead)
    .where(eq(eveDocumentHead.conversationId, childId));
  expect(heads).toEqual([]);
});

it("rejects a missing conversation before persisting a revision", async (): Promise<void> => {
  const conversationId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  await expect(
    saveEveDocumentRevision(revisionInput(conversationId, documentId))
  ).rejects.toThrow("Conversation not found.");
  await expect(
    getEveDocumentRevision("document-owner", conversationId, documentId)
  ).resolves.toBeUndefined();
});

it("preserves replay identity and empty revision selection", async (): Promise<void> => {
  const conversationId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  await seedConversation(conversationId);
  const input = revisionInput(conversationId, documentId);
  const saved = await saveEveDocumentRevision(input);
  await expect(saveEveDocumentRevision(input)).resolves.toEqual(saved);
  await expect(
    getEveDocumentRevision("document-owner", conversationId, documentId, "")
  ).resolves.toEqual(saved);
  await expect(
    saveEveDocumentRevision(
      revisionInput(conversationId, documentId, "Changed")
    )
  ).rejects.toThrow("Document operation changed during replay.");
});

it("snapshots native turn checkpoints and rejects absent published boundaries", async (): Promise<void> => {
  const conversationId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  await seedConversation(conversationId);
  const saved = await saveEveDocumentRevision(
    revisionInput(conversationId, documentId)
  );
  await captureEveDocumentCheckpoint(
    "document-owner",
    conversationId,
    NEXT_TURN_INDEX
  );
  const resources = { documentIds: [documentId], revisionIds: [saved.id] };
  const snapshot = await snapshotPublicEveCopyDocuments(
    conversationId,
    conversationId,
    resources,
    [
      {
        messageIndex: NEXT_TURN_INDEX,
        sourceIndex: NEXT_TURN_INDEX,
        sourceKind: "turn",
      },
    ]
  );
  expect(snapshot.documents).toMatchObject([
    { documentId, headRevisionId: saved.id, revisions: [{ id: saved.id }] },
  ]);
  expect(snapshot.checkpoints).toEqual([
    {
      heads: [{ documentId, revisionId: saved.id }],
      messageIndex: NEXT_TURN_INDEX,
    },
  ]);
  await expect(
    snapshotPublicEveCopyDocuments(conversationId, conversationId, resources, [
      {
        messageIndex: ABSENT_TURN_INDEX,
        sourceIndex: ABSENT_TURN_INDEX,
        sourceKind: "turn",
      },
    ])
  ).rejects.toThrow("Published document boundary is unavailable.");
});
