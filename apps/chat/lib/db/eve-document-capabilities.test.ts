import { readFile, readdir } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { eveChat, eveConversation, eveDocumentHead, user } from "./schema";

const postgres = new PGlite();
const database = drizzle(postgres);
const DATABASE_SETUP_TIMEOUT_MS = 30_000;
const FIRST_TURN_INDEX = 0;
const FIRST_INPUT_INDEX = 0;

vi.mock("./client", (): { db: typeof database } => ({ db: database }));
vi.mock("@/lib/env", () => ({ env: {} }));

const { getEveDocumentRevision, saveEveDocumentRevision } =
  await import("./eve-documents");

const { snapshotPublicEveCopyDocuments } = await import("./eve-copy-documents");
const { initializeEveCurrentCopy } = await import("./eve-current-copy");
const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/eve/completed-copy-source", () => ({
  readCompletedEveCopyTranscript: capture,
}));

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

it("rejects a missing conversation before persisting a revision", async (): Promise<void> => {
  const conversationId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  await expect(
    saveEveDocumentRevision(revisionInput(conversationId, documentId))
  ).rejects.toThrow("Conversation not found.");
  await expect(
    getEveDocumentRevision("document-owner", conversationId, documentId)
  ).resolves.toBeNull();
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

it("captures current document heads once and keeps retries independent of later source edits", async () => {
  const source = crypto.randomUUID();
  const target = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  await seedConversation(source);
  await seedConversation(target);
  await database
    .update(eveConversation)
    .set({
      state: "creating",
      sessionId: null,
      parentConversationId: source,
      chatId: source,
      rootConversationId: source,
      forkMessageId: "evt_source:user",
      forkKind: "edit",
    })
    .where(eq(eveConversation.id, target));
  const first = await saveEveDocumentRevision(
    revisionInput(source, documentId)
  );
  const seed = {
    messages: [
      { role: "user", parts: [{ type: "text", text: "Captured history" }] },
    ],
  };
  capture.mockResolvedValue({ seed });
  await expect(
    initializeEveCurrentCopy("foreign-owner", target)
  ).rejects.toThrow("Copy conversation not found");
  capture.mockRejectedValueOnce(new Error("Source still running"));
  await expect(
    initializeEveCurrentCopy("document-owner", target)
  ).rejects.toThrow("Source still running");
  expect(
    await database
      .select()
      .from(eveDocumentHead)
      .where(eq(eveDocumentHead.conversationId, target))
  ).toEqual([]);
  await initializeEveCurrentCopy("document-owner", target);
  expect(capture.mock.calls.at(-1)?.[4]).toBe("evt_source:user");
  await saveEveDocumentRevision({
    ...revisionInput(source, documentId),
    operationId: "later",
    expectedRevisionId: first.id,
    content: "Later edit",
  });
  capture.mockClear();
  await initializeEveCurrentCopy("document-owner", target);
  expect(capture).not.toHaveBeenCalled();
  const [head] = await database
    .select()
    .from(eveDocumentHead)
    .where(eq(eveDocumentHead.conversationId, target));
  expect(head.revisionId).toBe(first.id);
  const [copy] = await database
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, target));
  expect(copy.initialSeed).toEqual({ ...seed, attachments: "channel" });
});

it("captures public current heads inside an existing transaction", async () => {
  const source = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  await seedConversation(source);
  const saved = await saveEveDocumentRevision(
    revisionInput(source, documentId)
  );
  const result = await database.transaction(
    async (tx) =>
      await snapshotPublicEveCopyDocuments(
        source,
        source,
        { documentIds: [documentId], revisionIds: [saved.id] },
        tx
      )
  );
  expect(result.documents[0]?.headRevisionId).toBe(saved.id);
});
