import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { MessageStreamEvent } from "eve/client";
import { db } from "../lib/db/client";
import { env } from "../lib/env";
import {
  user,
  eveChat,
  eveConversation,
  eveDispatch,
  eveResponseGroup,
  eveDocumentHead,
  eveDocumentRevision,
  eveWorkspace,
  eveFileReference,
  eveStoredFile,
  eveWorkspaceAttachment,
} from "../lib/db/schema";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  cleanupWorkspaceIfUnused,
  checkDeletedWorkspaceMemberships,
} from "../lib/eve/persistent-sandbox-store";
import {
  getAccessibleEveDocument,
  getEveDocumentHistory,
  purgeEveFamilyDocuments,
} from "../lib/db/eve-documents";
import { canReadEveFile } from "../lib/db/eve-files";
import { initializeEveCurrentCopy } from "../lib/db/eve-current-copy";
import {
  createEveConversation,
  getEveCreation,
  beginEveConversationDeletion,
} from "../lib/db/eve-queries";
import {
  reserveEveResponseGroup,
  getEveResponseGroup,
} from "../lib/db/eve-response-groups";
import { prepareEveCopyTranscript } from "../lib/eve/copy-transcript";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

// Native snapshot transport is mocked; real transcript projection, reservation,
// workspace catalog enrichment and public file authorization use PostgreSQL.
const native = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("../lib/eve/completed-copy-source", () => ({
  readCompletedEveCopyTranscript: native.capture,
}));

assertEveTestDatabase(env.DATABASE_URL);
const ownerId = crypto.randomUUID();
beforeAll(async () => {
  await db.insert(user).values({
    id: ownerId,
    name: "Workspace copy authorization",
    email: `${ownerId}@example.test`,
  });
});
afterAll(async () => {
  await db.delete(eveDocumentHead).where(eq(eveDocumentHead.ownerId, ownerId));
  await db
    .delete(eveDocumentRevision)
    .where(eq(eveDocumentRevision.ownerId, ownerId));
  await db
    .delete(eveWorkspaceAttachment)
    .where(eq(eveWorkspaceAttachment.ownerId, ownerId));
  await db
    .delete(eveFileReference)
    .where(eq(eveFileReference.ownerId, ownerId));
  await db.delete(eveStoredFile).where(eq(eveStoredFile.ownerId, ownerId));
  await db.delete(eveDispatch).where(eq(eveDispatch.ownerId, ownerId));
  await db
    .delete(eveResponseGroup)
    .where(eq(eveResponseGroup.ownerId, ownerId));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, ownerId));
  await db.delete(eveChat).where(eq(eveChat.ownerId, ownerId));
  await db.delete(eveWorkspace).where(eq(eveWorkspace.ownerId, ownerId));
  await db.delete(user).where(eq(user.id, ownerId));
});

test.each(["early-message", "later-message"])(
  "a public fork before %s authorizes only attachments in its selected history",
  async (beforeMessageId) => {
    const earlyKey = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.png`;
    const laterKey = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.pdf`;
    const [source] = await insertEveConversationFixtures({
      ownerId,
      firstMessage: "Private source",
      operationId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      state: "bound",
    });
    await db.insert(eveStoredFile).values([
      { key: earlyKey, ownerId },
      { key: laterKey, ownerId },
    ]);
    await db.insert(eveFileReference).values(
      [earlyKey, laterKey].map((key) => ({
        key,
        conversationId: source.id,
        ownerId,
      }))
    );
    await db.insert(eveWorkspaceAttachment).values(
      [earlyKey, laterKey].map((fileKey) => ({
        fileKey,
        ownerId,
        workspaceId: source.workspaceId,
        sha256: "fixture-original",
        paths: [`/workspace/.eve/attachments/${fileKey}`],
      }))
    );
    const events: MessageStreamEvent[] = [
      {
        type: "history.seeded",
        meta: { at: "2026-10-20T00:00:00Z", id: "seed-fixture" },
        data: {
          messages: [
            {
              id: "early-message",
              role: "user",
              parts: [
                {
                  type: "file",
                  url: `http://localhost:3220/api/files/${earlyKey}`,
                  mediaType: "image/png",
                },
              ],
            },
            {
              id: "later-message",
              role: "user",
              parts: [
                {
                  type: "file",
                  url: `http://localhost:3220/api/files/${laterKey}`,
                  mediaType: "application/pdf",
                },
              ],
            },
          ],
        },
      },
      {
        type: "session.waiting",
        meta: { at: "2026-10-20T00:00:01Z", id: "idle-fixture" },
        data: {
          continuationToken: "fixture",
          wait: "next-user-message",
        },
      },
    ];
    native.capture.mockImplementation(
      async (
        _ownerId: string,
        _sessionId: string,
        _dispatches: unknown,
        _receipts: unknown,
        boundary: string
      ) => await Promise.resolve(prepareEveCopyTranscript(events, [], boundary))
    );
    const selectedKeys = beforeMessageId === "later-message" ? [earlyKey] : [];
    const fork = await createEveConversation(
      ownerId,
      crypto.randomUUID(),
      "Edited message",
      async (reservationId) => {
        const references = await db
          .select({ key: eveFileReference.key })
          .from(eveFileReference)
          .where(eq(eveFileReference.conversationId, reservationId));
        expect(references.map((row) => row.key)).toEqual(selectedKeys);
        return crypto.randomUUID();
      },
      { fork: { conversationId: source.id, beforeMessageId } }
    );
    await db
      .update(eveConversation)
      .set({ visibility: "public" })
      .where(eq(eveConversation.id, fork.id));

    expect(await canReadEveFile(laterKey)).toEqual({
      allowed: false,
      managed: true,
    });
    expect(await canReadEveFile(earlyKey)).toEqual({
      allowed: selectedKeys.length === 1,
      managed: true,
    });
    expect(await canReadEveFile(laterKey, ownerId)).toEqual({
      allowed: true,
      managed: true,
    });
    const catalog = await db
      .select({ key: eveWorkspaceAttachment.fileKey })
      .from(eveWorkspaceAttachment)
      .where(eq(eveWorkspaceAttachment.workspaceId, source.workspaceId));
    expect(catalog.map((entry) => entry.key).toSorted()).toEqual(
      [earlyKey, laterKey].toSorted()
    );
  }
);

test("a public historical fork cannot expose future document revisions or their files", async () => {
  const [source] = await insertEveConversationFixtures({
    ownerId,
    firstMessage: "Documents",
    operationId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    state: "bound",
  });
  const documentId = crypto.randomUUID();
  const laterDocumentId = crypto.randomUUID();
  const earlyId = crypto.randomUUID();
  const laterId = crypto.randomUUID();
  const unrelatedId = crypto.randomUUID();
  const earlyKey = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.png`;
  const laterKey = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.png`;
  await db
    .insert(eveStoredFile)
    .values([earlyKey, laterKey].map((key) => ({ key, ownerId })));
  await db.insert(eveFileReference).values(
    [earlyKey, laterKey].map((key) => ({
      key,
      ownerId,
      conversationId: source.id,
    }))
  );
  const revision = {
    ownerId,
    conversationId: source.id,
    documentId,
    title: "Notes",
    kind: "text" as const,
    turnIndex: 0,
  };
  await db.insert(eveDocumentRevision).values({
    ...revision,
    id: earlyId,
    operationId: crypto.randomUUID(),
    content: "Original",
    fileIds: [earlyKey],
  });
  await db.insert(eveDocumentRevision).values([
    {
      ...revision,
      id: laterId,
      operationId: crypto.randomUUID(),
      parentRevisionId: earlyId,
      content: "Future secret",
      fileIds: [laterKey],
    },
    {
      ...revision,
      documentId: laterDocumentId,
      id: unrelatedId,
      operationId: crypto.randomUUID(),
      content: "Later document",
    },
  ]);
  await db.insert(eveDocumentHead).values([
    { ownerId, conversationId: source.id, documentId, revisionId: laterId },
    {
      ownerId,
      conversationId: source.id,
      documentId: laterDocumentId,
      revisionId: unrelatedId,
    },
  ]);
  const events: MessageStreamEvent[] = [
    {
      type: "history.seeded",
      meta: { id: "documents", at: "2026-10-20T00:00:00Z" },
      data: {
        messages: [
          {
            id: "request",
            role: "user",
            parts: [{ type: "text", text: "Write notes" }],
          },
          {
            id: "answer",
            role: "assistant",
            parts: [
              {
                type: "dynamic-tool",
                toolCallId: "document-call",
                toolName: "createTextDocument",
                input: {},
                state: "output-available",
                output: { documentId, revisionId: earlyId },
              },
            ],
          },
          {
            id: "later",
            role: "user",
            parts: [{ type: "text", text: "Change them" }],
          },
        ],
      },
    },
    {
      type: "session.waiting",
      meta: { id: "idle-documents", at: "2026-10-20T00:00:01Z" },
      data: { continuationToken: "fixture", wait: "next-user-message" },
    },
  ];
  native.capture.mockImplementation(
    async () =>
      await Promise.resolve(prepareEveCopyTranscript(events, [], "later"))
  );
  const fork = await createEveConversation(
    ownerId,
    crypto.randomUUID(),
    "Fork",
    async () => await Promise.resolve(crypto.randomUUID()),
    { fork: { conversationId: source.id, beforeMessageId: "later" } }
  );
  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, fork.id));
  const visible = await getAccessibleEveDocument(
    undefined,
    fork.id,
    documentId
  );
  expect(visible?.revision.id).toBe(earlyId);
  expect(visible?.revision.content).toBe("Original");
  expect(
    await getAccessibleEveDocument(undefined, fork.id, documentId, laterId)
  ).toBeUndefined();
  expect(
    await getAccessibleEveDocument(undefined, fork.id, laterDocumentId)
  ).toBeUndefined();
  expect(await canReadEveFile(earlyKey)).toEqual({
    allowed: true,
    managed: true,
  });
  expect(await canReadEveFile(laterKey)).toEqual({
    allowed: false,
    managed: true,
  });
});

test("an already captured seed remains replayable while its delivery is fenced", async () => {
  const [source] = await insertEveConversationFixtures({
    ownerId,
    firstMessage: "Source",
    operationId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    state: "bound",
  });
  const [target] = await insertEveConversationFixtures({
    ownerId,
    firstMessage: "Fork",
    operationId: crypto.randomUUID(),
    state: "uncertain",
    parentConversationId: source.id,
    rootConversationId: source.id,
    workspaceId: source.workspaceId,
    initialSeed: {
      messages: [{ role: "user", parts: [{ type: "text", text: "Captured" }] }],
    },
  });
  const activeOperationId = crypto.randomUUID();
  await db
    .update(eveWorkspace)
    .set({ activeOperationId })
    .where(eq(eveWorkspace.id, source.workspaceId));
  native.capture.mockClear();
  await initializeEveCurrentCopy(ownerId, target.id);
  expect(native.capture).not.toHaveBeenCalled();
  const [workspace] = await db
    .select()
    .from(eveWorkspace)
    .where(eq(eveWorkspace.id, source.workspaceId));
  expect(workspace.activeOperationId).toBe(activeOperationId);
});

test.each(["retry", "delete"])(
  "a never-dispatched busy fork allows %s with immutable intent",
  async (action) => {
    const [source] = await insertEveConversationFixtures({
      ownerId,
      firstMessage: "busy source",
      operationId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      state: "bound",
    });
    await db
      .update(eveWorkspace)
      .set({ activeOperationId: crypto.randomUUID() })
      .where(eq(eveWorkspace.id, source.workspaceId));
    const group = await reserveEveResponseGroup(ownerId, {
      operationId: crypto.randomUUID(),
      message: "blocked fork",
      modelIds: ["model-a", "model-b"],
      fork: { conversationId: source.id },
    });
    const [{ operationId }] = group.candidates;
    const dispatch = vi.fn(() => crypto.randomUUID());
    await expect(
      createEveConversation(ownerId, operationId, "blocked fork", dispatch, {
        fork: { conversationId: source.id },
      })
    ).rejects.toThrow("workspace");
    expect(dispatch).not.toHaveBeenCalled();
    const reservation = await getEveCreation(ownerId, operationId);
    expect(reservation?.state).toBe("creating");
    if (!reservation) {
      throw new Error("Missing busy reservation");
    }
    const waitingGroup = await getEveResponseGroup(ownerId, group.id);
    expect(waitingGroup?.candidates[0]).toMatchObject({
      operationId,
      state: "waiting",
    });
    expect(
      await db
        .select()
        .from(eveDispatch)
        .where(eq(eveDispatch.conversationId, reservation.id))
    ).toHaveLength(0);
    await expect(
      createEveConversation(ownerId, operationId, "changed intent", dispatch, {
        fork: { conversationId: source.id },
      })
    ).rejects.toThrow("different");
    if (action === "retry") {
      // The external writer has now completed. Only this fixture supplies that fact.
      await db
        .update(eveWorkspace)
        .set({ activeOperationId: null })
        .where(eq(eveWorkspace.id, source.workspaceId));
      native.capture.mockResolvedValue({
        seed: {
          messages: [
            {
              role: "user",
              parts: [{ type: "text", text: "Completed source" }],
            },
          ],
        },
        resources: { fileKeys: [], documentIds: [], revisionIds: [] },
        projectionHash: "settled",
      });
      const result = await createEveConversation(
        ownerId,
        operationId,
        "blocked fork",
        dispatch,
        {
          fork: { conversationId: source.id },
        }
      );
      expect(result.id).toBe(reservation.id);
      const boundGroup = await getEveResponseGroup(ownerId, group.id);
      expect(boundGroup?.candidates[0]).toMatchObject({
        operationId,
        state: "bound",
        conversationId: reservation.id,
      });
      expect(dispatch).toHaveBeenCalledOnce();
    } else {
      const deletion = await beginEveConversationDeletion(
        ownerId,
        source.chatId
      );
      expect(deletion?.conversations.map((row) => row.id)).toEqual([source.id]);
      const retired = await getEveCreation(ownerId, operationId);
      expect(retired?.state).toBe("deleting");
      expect(dispatch).not.toHaveBeenCalled();
    }
  }
);

test("original deletion retains fork document ancestry until the last member is deleted", async () => {
  const [source] = await insertEveConversationFixtures({
    ownerId,
    firstMessage: "Documents",
    operationId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    state: "bound",
  });
  const [fork] = await insertEveConversationFixtures({
    ownerId,
    firstMessage: "Fork",
    operationId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    state: "bound",
    parentConversationId: source.id,
    rootConversationId: source.id,
  });
  const documentId = crypto.randomUUID();
  const originalId = crypto.randomUUID();
  const sharedId = crypto.randomUUID();
  const futureId = crypto.randomUUID();
  const base = {
    ownerId,
    conversationId: source.id,
    documentId,
    kind: "text" as const,
    title: "Notes",
  };
  await db.insert(eveDocumentRevision).values({
    ...base,
    id: originalId,
    operationId: crypto.randomUUID(),
    content: "Original",
  });
  await db.insert(eveDocumentRevision).values({
    ...base,
    id: sharedId,
    parentRevisionId: originalId,
    operationId: crypto.randomUUID(),
    content: "Shared",
  });
  await db.insert(eveDocumentRevision).values({
    ...base,
    id: futureId,
    parentRevisionId: sharedId,
    operationId: crypto.randomUUID(),
    content: "Later private revision",
  });
  await db.insert(eveDocumentHead).values([
    { ownerId, conversationId: source.id, documentId, revisionId: futureId },
    { ownerId, conversationId: fork.id, documentId, revisionId: sharedId },
  ]);
  await beginEveConversationDeletion(ownerId, source.id);
  await db.transaction(async (tx) => {
    await checkDeletedWorkspaceMemberships(ownerId, [source.id], tx);
    const available = await db.transaction(async (other) => {
      const [row] = await other.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtextextended(${`chatjs-workspace:${source.workspaceId}`}, 0)) as locked`
      );
      return row.locked;
    });
    expect(available).toBe(false);
  });
  await purgeEveFamilyDocuments(ownerId, source.id);
  await completeEveConversationDeletion(ownerId, source.id);
  const history = await getEveDocumentHistory(ownerId, fork.id, documentId);
  expect(history.map((revision) => revision.id)).toEqual([
    originalId,
    sharedId,
  ]);
  expect(
    await db
      .select()
      .from(eveDocumentRevision)
      .where(eq(eveDocumentRevision.id, futureId))
  ).toEqual([]);
  const visible = await getAccessibleEveDocument(ownerId, fork.id, documentId);
  expect(visible?.revision.content).toBe("Shared");
  await beginEveConversationDeletion(ownerId, fork.id);
  await purgeEveFamilyDocuments(ownerId, fork.id);
  await cleanupWorkspaceIfUnused(ownerId, source.workspaceId, () => {
    throw new Error("No sandbox was allocated");
  });
  await completeEveConversationDeletion(ownerId, fork.id);
  await purgeEveFamilyDocuments(ownerId, fork.id);
  expect(
    await db
      .select()
      .from(eveDocumentRevision)
      .where(eq(eveDocumentRevision.documentId, documentId))
  ).toEqual([]);
});
