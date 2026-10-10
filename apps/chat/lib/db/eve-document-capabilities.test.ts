/* oxlint-disable import/no-nodejs-modules -- The local database test applies the real checked-in SQL migrations. */
import { readFile, readdir } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
/* oxlint-disable sort-imports -- Keep Vitest API evaluation after PGlite and Drizzle adapter imports, then schema evaluation: schema imports encrypted-text and env, whose module validates env; vi.mock supplies the local adapter before dynamic production imports. */
import { afterAll, beforeAll, expect, it, vi } from "vitest";
/* oxlint-enable import/no-nodejs-modules */

import { eveChat, eveConversation, user } from "./schema";
/* oxlint-enable sort-imports */

const postgres = new PGlite();
const database = drizzle(postgres);
const DATABASE_SETUP_TIMEOUT_MS = 30_000;
const FIRST_TURN_INDEX = 0;
const FIRST_INPUT_INDEX = 0;
const NEXT_TURN_INDEX = 1;
const ABSENT_TURN_INDEX = 2;

vi.mock("./client", (): { db: typeof database } => ({ db: database }));
vi.mock("@/lib/env", () => ({ env: {} }));

/* oxlint-disable node/no-top-level-await -- Load production modules after installing the local test adapter. */
const {
  captureEveDocumentCheckpoint,
  getEveDocumentRevision,
  saveEveDocumentRevision,
} = await import("./eve-documents");

const { snapshotPublicEveCopyDocuments } = await import("./eve-copy-documents");
/* oxlint-enable node/no-top-level-await */

/* oxlint-disable oxc/no-async-await -- The tests exercise actual query order, transaction rollback and rejected promises. */
beforeAll(async (): Promise<void> => {
  const migrationDirectory = new URL("migrations/", import.meta.url);
  const entries = await readdir(migrationDirectory);
  const filenames = entries.filter((name) => name.endsWith(".sql")).toSorted();
  /* oxlint-disable eslint/no-await-in-loop -- Apply checked-in SQL migrations in order, before seeding fixtures. */
  for (const name of filenames) {
    await postgres.exec(
      await readFile(new URL(name, migrationDirectory), "utf-8")
    );
  }
  /* oxlint-enable eslint/no-await-in-loop */
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
  // oxlint-disable-next-line unicorn/no-null -- The first native revision explicitly has no parent.
  expectedRevisionId: null,
  fileIds: [],
  kind: "text",
  operationId: `save:${documentId}`,
  ownerId: "document-owner",
  title,
  turnIndex: FIRST_TURN_INDEX,
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
/* oxlint-enable oxc/no-async-await */
