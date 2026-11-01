import {
  eveDispatch,
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
  eveNamedDocumentCheckpoint,
  eveNamedDocumentCheckpointEntry,
  eveStoredFile,
  user,
} from "../lib/db/schema";
import { createEveTestSession } from "./eve-native-session.fixture";

import assert from "node:assert/strict";

import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { db } from "../lib/db/client";
import { cleanupWorkspaceIfUnused } from "../lib/eve/persistent-sandbox-store";
import { reconcileEveWorkspaceTurn } from "../lib/eve/reconcile-workspace-turn";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  getAccessibleEveDocument,
  getEveDocumentHistory,
  getEveDocumentRevision,
  purgeEveFamilyDocuments,
  removeEveDocumentFromConversation,
  saveEveDocumentRevision,
} from "../lib/db/eve-documents";
import { prepareEveFamilyFilePurge } from "../lib/db/eve-file-purge";
import { referenceEveFiles, registerEveStoredFile } from "../lib/db/eve-files";
import {
  beginEveConversationDeletion,
  getEveConversation,
  createEveConversation,
} from "../lib/db/eve-queries";
import { env } from "../lib/env";
import { executeEveDocumentTool } from "../lib/eve/document-tools";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
const stranger = crypto.randomUUID();
await db.insert(user).values(
  [owner, stranger].map((id) => ({
    email: `${id}@test.invalid`,
    id,
    name: "Artifact fixture",
  }))
);
afterAll(async () => {
  await db.delete(eveDispatch).where(eq(eveDispatch.ownerId, owner));
  await db
    .delete(eveImportedDocumentCheckpointEntry)
    .where(eq(eveImportedDocumentCheckpointEntry.ownerId, owner));
  await db
    .delete(eveImportedDocumentCheckpoint)
    .where(eq(eveImportedDocumentCheckpoint.ownerId, owner));
  await db
    .delete(eveNamedDocumentCheckpointEntry)
    .where(eq(eveNamedDocumentCheckpointEntry.ownerId, owner));
  await db
    .delete(eveNamedDocumentCheckpoint)
    .where(eq(eveNamedDocumentCheckpoint.ownerId, owner));
  await db
    .delete(eveDocumentCheckpointEntry)
    .where(eq(eveDocumentCheckpointEntry.ownerId, owner));
  await db
    .delete(eveDocumentCheckpoint)
    .where(eq(eveDocumentCheckpoint.ownerId, owner));
  await db.delete(eveDocumentHead).where(eq(eveDocumentHead.ownerId, owner));
  await db
    .delete(eveDocumentRevision)
    .where(eq(eveDocumentRevision.ownerId, owner));
  await db.delete(eveFileReference).where(eq(eveFileReference.ownerId, owner));
  await db
    .delete(eveStoredFile)
    .where(inArray(eveStoredFile.ownerId, [owner, stranger]));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
  await db.delete(user).where(eq(user.id, stranger));
});

const conversation = async () =>
  await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Artifact fixture",
    createEveTestSession
  );

const draft = (conversationId: string) => ({
  content: "Original",
  conversationId,
  documentId: crypto.randomUUID(),
  expectedRevisionId: null,
  fileIds: [],
  kind: "text" as const,
  operationId: crypto.randomUUID(),
  ownerId: owner,
  title: "Notes",
  turnIndex: 0,
});

test("document purge requires the owned family fence, erases inherited revisions, and is retryable", async () => {
  const root = await conversation();
  const input = draft(root.id);
  const original = await saveEveDocumentRevision(input);
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Purge fork",
    createEveTestSession,
    { fork: { conversationId: root.id } }
  );
  await saveEveDocumentRevision({
    ...input,
    content: "Child revision",
    conversationId: child.id,
    expectedRevisionId: original.id,
    operationId: crypto.randomUUID(),
  });
  const unrelated = await conversation();
  const surviving = await saveEveDocumentRevision(draft(unrelated.id));

  await expect(purgeEveFamilyDocuments(owner, root.id)).rejects.toThrow(
    "entire conversation family"
  );
  const source = await getEveConversation(owner, root.id);
  assert.ok(source);
  await reconcileEveWorkspaceTurn(owner, root.id);
  const deletion = await beginEveConversationDeletion(owner, source.chatId);
  await cleanupWorkspaceIfUnused(owner, source.workspaceId, () => {
    throw new Error("Text-only fixture must not allocate a sandbox");
  });
  assert.ok(deletion);
  await expect(purgeEveFamilyDocuments(stranger, root.id)).rejects.toThrow();
  await expect(purgeEveFamilyDocuments(owner, unrelated.id)).rejects.toThrow();
  await expect(
    completeEveConversationDeletion(owner, deletion.rootId)
  ).rejects.toThrow("content cleanup is incomplete");
  await purgeEveFamilyDocuments(owner, deletion.rootId);
  await purgeEveFamilyDocuments(owner, deletion.rootId);
  await Promise.all(
    [eveDocumentHead, eveDocumentRevision].map(async (table) => {
      expect(
        await db
          .select({ conversationId: table.conversationId })
          .from(table)
          .where(inArray(table.conversationId, [root.id, child.id]))
      ).toEqual([]);
    })
  );
  expect(
    await getEveDocumentRevision(owner, unrelated.id, surviving.documentId)
  ).toEqual(surviving);
  const familyConversationStates = await db
    .select({ state: eveConversation.state })
    .from(eveConversation)
    .where(inArray(eveConversation.id, [root.id, child.id]));
  expect(familyConversationStates.map((row) => row.state)).toEqual([
    "deleting",
    "deleting",
  ]);
  await expect(
    saveEveDocumentRevision({
      ...input,
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow();
});

test("an external document reference rolls back every purge step", async () => {
  const root = await conversation();
  const input = draft(root.id);
  const revision = await saveEveDocumentRevision(input);
  const external = await conversation();
  // Model a reference outside the deletion family. Do not cascade it away.
  await db.insert(eveDocumentHead).values({
    conversationId: external.id,
    documentId: input.documentId,
    ownerId: owner,
    revisionId: revision.id,
  });
  await beginEveConversationDeletion(owner, root.id);
  await expect(purgeEveFamilyDocuments(owner, root.id)).rejects.toThrow();
  await Promise.all(
    [eveDocumentHead, eveDocumentRevision].map(async (table) => {
      expect(
        await db
          .select({ conversationId: table.conversationId })
          .from(table)
          .where(eq(table.conversationId, root.id))
      ).toHaveLength(1);
    })
  );
  expect(
    await db
      .select()
      .from(eveDocumentHead)
      .where(eq(eveDocumentHead.conversationId, external.id))
  ).toHaveLength(1);
});

test("a document save cancelled while waiting for its lock never writes", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const controller = new AbortController();
  const held: PromiseWithResolvers<void> = Promise.withResolvers();
  const release: PromiseWithResolvers<void> = Promise.withResolvers();
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
  const cancelledSaveResults = await saving;
  expect(cancelledSaveResults[0].status).toBe("rejected");
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
    content: "Private later version",
    expectedRevisionId: first.id,
    operationId: crypto.randomUUID(),
    turnIndex: 1,
  });
  expect(
    await getAccessibleEveDocument(undefined, chat.id, input.documentId)
  ).toBeUndefined();
  expect(
    await getAccessibleEveDocument(stranger, chat.id, input.documentId)
  ).toBeUndefined();
  expect(
    await getAccessibleEveDocument(owner, chat.id, input.documentId)
  ).toMatchObject({
    canEdit: true,
    revision: { content: "Private later version" },
  });
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Public branch",
    createEveTestSession,
    { fork: { conversationId: chat.id } }
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
    canEdit: false,
    revision: { content: "Private later version", id: later.id },
  });
  expect(visible?.revision).not.toHaveProperty("ownerId");
  expect(visible?.revision).not.toHaveProperty("operationId");
  expect(visible?.history).toHaveLength(2);
  expect(
    await getAccessibleEveDocument(
      undefined,
      child.id,
      input.documentId,
      later.id
    )
  ).toMatchObject({ revision: { id: later.id } });
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
    attributes: {},
    authenticator: "test",
    principalId: owner,
    principalType: "user",
  };
  const context = {
    abortSignal: new AbortController().signal,
    callId: crypto.randomUUID(),
    session: {
      auth: { current: principal, initiator: principal },
      id: chat.sessionId,
      turn: { id: "turn_0", sequence: 0 },
    },
  };
  const input = { content: "Original", fileIds: [], title: "Native notes" };
  await expect(
    executeEveDocumentTool(
      "createTextDocument",
      { content: input.content, title: input.title },
      context
    )
  ).rejects.toThrow("fileIds");
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
    Array.from({ length: 8 }, async () => await saveEveDocumentRevision(input))
  );
  expect(new Set(revisions.map((revision) => revision.id)).size).toBe(1);
  const second = await saveEveDocumentRevision({
    ...input,
    content: "Updated",
    expectedRevisionId: revisions[0].id,
    operationId: crypto.randomUUID(),
    turnIndex: 1,
  });
  const replayedRevision = await saveEveDocumentRevision(input);
  expect(replayedRevision.id).toBe(revisions[0].id);
  const latestDocumentHistory = await getEveDocumentHistory(
    owner,
    chat.id,
    input.documentId
  );
  expect(latestDocumentHistory.at(-1)?.id).toBe(second.id);
  await expect(
    saveEveDocumentRevision({ ...input, content: "Changed replay" })
  ).rejects.toThrow("replay");
});

test("two distinct saves from the same revision cannot overwrite each other", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  const outcomes = await Promise.allSettled(
    ["A", "B"].map(
      async (content) =>
        await saveEveDocumentRevision({
          ...input,
          content,
          expectedRevisionId: first.id,
          operationId: crypto.randomUUID(),
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
      expectedRevisionId: first.id,
      operationId: crypto.randomUUID(),
      ownerId: stranger,
    })
  ).rejects.toThrow("not found");
  await expect(
    saveEveDocumentRevision({
      ...input,
      conversationId: other.id,
      expectedRevisionId: first.id,
      operationId: crypto.randomUUID(),
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

test("history beyond 1000 revisions remains readable and forkable without loading all contents", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  const ids = Array.from({ length: 1000 }, () => crypto.randomUUID());
  await db.insert(eveDocumentRevision).values(
    ids.map((id, index) => ({
      content: "content remains separately loaded",
      conversationId: chat.id,
      documentId: input.documentId,
      id,
      kind: input.kind,
      operationId: id,
      ownerId: owner,
      parentRevisionId: index === 0 ? first.id : ids[index - 1],
      title: "Long history",
      turnIndex: index + 1,
    }))
  );
  const tail = ids.at(-1);
  if (tail === undefined || tail === null || tail === "") {
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
    content: "Newest",
    expectedRevisionId: tail,
    operationId: crypto.randomUUID(),
    turnIndex: 1001,
  });
  const history = await getEveDocumentHistory(owner, chat.id, input.documentId);
  expect(history).toHaveLength(1002);
  expect(history.at(-1)?.id).toBe(newest.id);
  expect(history.every((version) => !("content" in version))).toBe(true);
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Long fork",
    createEveTestSession,
    { fork: { conversationId: chat.id } }
  );
  const longChildHistory = await getEveDocumentHistory(
    owner,
    child.id,
    input.documentId
  );
  expect(longChildHistory.at(-1)?.id).toBe(newest.id);
  expect(
    await getEveDocumentRevision(owner, child.id, input.documentId, newest.id)
  ).toMatchObject({ id: newest.id });
});

test("document references protect owned files across families and revision history", async () => {
  const prefix = "/api/files/";
  const source = await conversation();
  const destination = await conversation();
  const key = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.png`;
  const foreignKey = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.png`;
  await registerEveStoredFile(owner, key);
  await registerEveStoredFile(stranger, foreignKey);
  await referenceEveFiles(owner, source.id, [key]);
  const input = {
    ...draft(destination.id),
    content: `![image](${prefix}${key})\nForeign URL: ${prefix}${foreignKey}`,
    fileIds: [key],
  };
  await expect(
    saveEveDocumentRevision({ ...input, fileIds: [foreignKey] })
  ).rejects.toThrow("unowned file");
  const revision = await saveEveDocumentRevision(input);
  expect(revision.fileIds).toEqual([key]);
  await saveEveDocumentRevision({
    ...input,
    fileIds: [],
    content: "Image removed from latest revision",
    expectedRevisionId: revision.id,
    operationId: crypto.randomUUID(),
  });
  expect(
    await db
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(eq(eveFileReference.conversationId, destination.id))
  ).toEqual([{ key }]);
  const deletion = await beginEveConversationDeletion(owner, source.id);
  if (!deletion) {
    throw new Error("Missing source family deletion");
  }
  expect(await prepareEveFamilyFilePurge(owner, deletion.rootId)).toEqual([]);
  const copiedDocumentRevision = await getEveDocumentRevision(
    owner,
    destination.id,
    input.documentId,
    revision.id
  );
  expect(copiedDocumentRevision?.content).toBe(input.content);
});

test("approved deletion is scoped, revision-checked, retryable, and preserves independently copied heads", async () => {
  const root = await conversation();
  const input = draft(root.id);
  const original = await saveEveDocumentRevision(input);
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Retained fork",
    createEveTestSession,
    {
      fork: { conversationId: root.id },
    }
  );
  const deletion = {
    documentId: input.documentId,
    expectedRevisionId: original.id,
    title: original.title,
  };
  const scope = { ownerId: owner, conversationId: root.id };
  const { signal } = new AbortController();
  await expect(
    removeEveDocumentFromConversation(
      deletion,
      { ...scope, ownerId: stranger },
      signal
    )
  ).rejects.toThrow("Conversation not found");
  await expect(
    removeEveDocumentFromConversation(
      { ...deletion, title: "Misleading title" },
      scope,
      signal
    )
  ).rejects.toThrow("Document changed");
  const edited = await saveEveDocumentRevision({
    ...input,
    expectedRevisionId: original.id,
    operationId: crypto.randomUUID(),
    content: "New content",
    turnIndex: 1,
  });
  await expect(
    removeEveDocumentFromConversation(deletion, scope, signal)
  ).rejects.toThrow("Document changed");
  const currentDeletion = { ...deletion, expectedRevisionId: edited.id };
  await removeEveDocumentFromConversation(currentDeletion, scope, signal);
  await removeEveDocumentFromConversation(currentDeletion, scope, signal);
  expect(
    await getEveDocumentRevision(owner, root.id, input.documentId)
  ).toBeNull();
  const childRevisionAfterDeletion = await getEveDocumentRevision(
    owner,
    child.id,
    input.documentId
  );
  expect(childRevisionAfterDeletion?.id).toBe(original.id);
  const later = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "After deletion",
    createEveTestSession,
    {
      fork: { conversationId: root.id },
    }
  );
  expect(
    await getEveDocumentRevision(owner, later.id, input.documentId)
  ).toBeNull();
  const replacement = await saveEveDocumentRevision({
    ...input,
    operationId: crypto.randomUUID(),
    content: "Replacement",
    turnIndex: 2,
  });
  await expect(
    removeEveDocumentFromConversation(currentDeletion, scope, signal)
  ).rejects.toThrow("Document changed");
  const rootRevisionAfterDeletion = await getEveDocumentRevision(
    owner,
    root.id,
    input.documentId
  );
  expect(rootRevisionAfterDeletion?.id).toBe(replacement.id);
});
