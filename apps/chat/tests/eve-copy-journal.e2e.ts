/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { createHash, randomBytes } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import {
  dispatchEveCopy,
  rejectUnacceptedEveCopy,
  resolveAcceptedEveCopySeed,
} from "../lib/db/eve-copy-dispatch";
import {
  getEveCopyOperation,
  reserveEveCopyOperation,
} from "../lib/db/eve-copy-journal";
import {
  acceptEveCopy,
  writeEveCopyDocuments,
  writeEveCopyFile,
} from "../lib/db/eve-copy-resources";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import { purgeEveFamilyDocuments } from "../lib/db/eve-documents";
import { createEveConversation } from "../lib/db/eve-queries";
import {
  eveConversation,
  eveConversationCopy,
  eveConversationCopyFile,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
  eveStoredFile,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import type { EveCopyPlan } from "../lib/eve/copy-journal-contract";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const invalidSeedError = /Too small|byte limit/u;
const ownerId = crypto.randomUUID();
const sourceOwnerId = crypto.randomUUID();
const owners = [ownerId, sourceOwnerId];
await db.insert(user).values(
  owners.map((id) => ({
    email: `${id}@test.invalid`,
    id,
    name: "Copy journal fixture",
  }))
);
afterAll(async () => {
  for (const table of [
    eveConversationCopyFile,
    eveConversationCopy,
    eveImportedDocumentCheckpointEntry,
    eveImportedDocumentCheckpoint,
    eveDocumentHead,
    eveDocumentRevision,
    eveFileReference,
    eveStoredFile,
    eveConversation,
  ]) {
    await db.delete(table).where(inArray(table.ownerId, owners));
  }
  await db.delete(user).where(inArray(user.id, owners));
});
const bytes = Buffer.from("public fixture");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const key = () => randomBytes(18).toString("base64url");

async function fixture() {
  const sourceId = crypto.randomUUID();
  const sourceSessionId = crypto.randomUUID();
  const sourceKey = key();
  const targetKey = key();
  const sourceDocumentId = crypto.randomUUID();
  const sourceRevisionId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  await insertEveConversationFixtures({
    firstMessage: "Shared",
    id: sourceId,
    operationId: crypto.randomUUID(),
    ownerId: sourceOwnerId,
    sessionId: sourceSessionId,
    state: "bound",
    visibility: "public",
  });
  await db
    .insert(eveStoredFile)
    .values({ key: sourceKey, ownerId: sourceOwnerId });
  await db.insert(eveFileReference).values({
    conversationId: sourceId,
    key: sourceKey,
    ownerId: sourceOwnerId,
  });
  await db.insert(eveDocumentRevision).values({
    content: "Shared revision",
    conversationId: sourceId,
    documentId: sourceDocumentId,
    id: sourceRevisionId,
    kind: "text",
    operationId: "published",
    ownerId: sourceOwnerId,
    title: "Source",
  });
  await db.insert(eveDocumentHead).values({
    conversationId: sourceId,
    documentId: sourceDocumentId,
    ownerId: sourceOwnerId,
    revisionId: sourceRevisionId,
  });
  const plan: EveCopyPlan = {
    documentCheckpoints: [{ messageIndex: 0, heads: [] }],
    documents: [
      {
        documentId,
        headRevisionId: revisionId,
        revisions: [
          {
            id: revisionId,
            parentRevisionId: null,
            title: "Copied",
            content: `Image: /api/files/content?key=${targetKey}`,
            kind: "text",
            createdAt: new Date(0).toISOString(),
          },
        ],
      },
    ],
    files: [
      {
        key: targetKey,
        source: { kind: "stored", key: sourceKey },
        sha256,
        size: bytes.length,
        mediaType: "image/png",
      },
    ],
    seed: {
      attachments: "channel",
      messages: [
        {
          role: "user",
          parts: [
            {
              type: "file",
              url: `https://chatjs.example/api/files/content?key=${targetKey}`,
              mediaType: "image/png",
              size: bytes.length,
            },
          ],
        },
        { role: "assistant", parts: [{ type: "text", text: "Saved answer" }] },
      ],
    },
    sourceHeads: [
      { documentId: sourceDocumentId, revisionId: sourceRevisionId },
    ],
  };
  const input = {
    modelId: "google/gemini-2.5-flash-lite",
    operationId: crypto.randomUUID(),
    plan,
    projectionHash: sha256,
    sourceConversationId: sourceId,
    sourceOwnerId,
    sourceSessionId,
    title: "Saved answer",
  };
  const saved = await reserveEveCopyOperation(ownerId, input);
  const storage = {
    readSourceFile: vi.fn(() =>
      Promise.resolve(new Blob([bytes], { type: "image/png" }))
    ),
    writeDestinationFile: vi.fn((_key: string, _file: Blob) =>
      Promise.resolve()
    ),
  };
  return {
    documentId,
    input,
    revisionId,
    saved,
    sourceDocumentId,
    sourceId,
    sourceKey,
    sourceRevisionId,
    storage,
    targetKey,
  };
}
async function prepare(f: Awaited<ReturnType<typeof fixture>>) {
  await writeEveCopyFile(
    ownerId,
    f.saved.conversation.id,
    f.targetKey,
    f.storage
  );
  await writeEveCopyDocuments(ownerId, f.saved.conversation.id);
}

test("reserves one immutable root and destination resources before writes, rejecting changed intent and cross-kind replay", async () => {
  const f = await fixture();
  const replay = await Promise.all(
    Array.from({ length: 3 }, () => reserveEveCopyOperation(ownerId, f.input))
  );
  expect(replay.map((row) => row.conversation.id)).toEqual(
    Array.from({ length: 3 }, () => f.saved.conversation.id)
  );
  expect(f.saved.conversation).toMatchObject({
    creationKind: "copy",
    parentConversationId: null,
    rootConversationId: null,
    sessionId: null,
  });
  expect(f.storage.writeDestinationFile).not.toHaveBeenCalled();
  const [reference] = await db
    .select()
    .from(eveFileReference)
    .where(eq(eveFileReference.conversationId, f.saved.conversation.id));
  expect(reference).toMatchObject({ key: f.targetKey, ownerId });
  await expect(
    reserveEveCopyOperation(ownerId, {
      ...f.input,
      plan: { ...f.input.plan, seed: { ...f.input.plan.seed, messages: [] } },
    })
  ).rejects.toThrow();
  const create = vi.fn(() => Promise.resolve("wrong namespace"));
  await expect(
    createEveConversation(ownerId, f.input.operationId, f.input.title, create)
  ).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
  const messageOperation = crypto.randomUUID();
  await createEveConversation(ownerId, messageOperation, "Normal", () =>
    Promise.resolve(crypto.randomUUID())
  );
  await expect(
    reserveEveCopyOperation(ownerId, {
      ...f.input,
      operationId: messageOperation,
    })
  ).rejects.toThrow("ordinary message");
});

test("cannot accept or expose a native seed before file and document receipts commit", async () => {
  const f = await fixture();
  const { id } = f.saved.conversation;
  await expect(acceptEveCopy(ownerId, id)).rejects.toThrow("documents");
  await expect(resolveAcceptedEveCopySeed(ownerId, id)).rejects.toThrow();
  const create = vi.fn(() => Promise.resolve("not allowed"));
  await expect(dispatchEveCopy(ownerId, id, create)).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
  await writeEveCopyDocuments(ownerId, id);
  await expect(acceptEveCopy(ownerId, id)).rejects.toThrow("file writes");
  f.storage.readSourceFile.mockResolvedValueOnce(
    new Blob(["changed bytes"], { type: "image/png" })
  );
  await expect(
    writeEveCopyFile(ownerId, id, f.targetKey, f.storage)
  ).rejects.toThrow("changed after preparation");
  expect(f.storage.writeDestinationFile).not.toHaveBeenCalled();
  await prepare(f);
  expect(await acceptEveCopy(ownerId, id)).toBe("accepted");
  expect(await resolveAcceptedEveCopySeed(ownerId, id)).toEqual(
    f.input.plan.seed
  );
  expect(
    (await getEveCopyOperation(ownerId, f.input.operationId))?.copy.plan
  ).toBeNull();
});

test("an uncertain file write retries the same allocated key and records completion once", async () => {
  const f = await fixture();
  f.storage.writeDestinationFile.mockRejectedValueOnce(
    new Error("Lost storage response")
  );
  await expect(
    writeEveCopyFile(ownerId, f.saved.conversation.id, f.targetKey, f.storage)
  ).rejects.toThrow("Lost storage");
  const [pending] = await db
    .select()
    .from(eveConversationCopyFile)
    .where(eq(eveConversationCopyFile.conversationId, f.saved.conversation.id));
  expect(pending.writtenAt).toBeNull();
  await writeEveCopyFile(
    ownerId,
    f.saved.conversation.id,
    f.targetKey,
    f.storage
  );
  await writeEveCopyFile(
    ownerId,
    f.saved.conversation.id,
    f.targetKey,
    f.storage
  );
  expect(
    f.storage.writeDestinationFile.mock.calls.map((call) => call[0])
  ).toEqual([f.targetKey, f.targetKey]);
});

test("accepted copies recover after source revocation and a lost native reply, then discard temporary transcript data", async () => {
  const f = await fixture();
  await prepare(f);
  await acceptEveCopy(ownerId, f.saved.conversation.id);
  await db
    .update(eveConversation)
    .set({ state: "deleting", visibility: "private" })
    .where(eq(eveConversation.id, f.sourceId));
  const nativeId = crypto.randomUUID();
  const operations: string[] = [];
  await expect(
    dispatchEveCopy(ownerId, f.saved.conversation.id, (operation) => {
      operations.push(operation);
      return Promise.reject(new Error("Lost native response"));
    })
  ).rejects.toThrow("Lost native");
  expect(
    (await getEveCopyOperation(ownerId, f.input.operationId))?.conversation
      .state
  ).toBe("uncertain");
  expect(
    await resolveAcceptedEveCopySeed(ownerId, f.saved.conversation.id)
  ).toEqual(f.input.plan.seed);
  const bound = await dispatchEveCopy(
    ownerId,
    f.saved.conversation.id,
    (operation) => {
      operations.push(operation);
      return Promise.resolve(nativeId);
    }
  );
  const noDispatch = vi.fn(() => Promise.resolve("duplicate"));
  expect(
    await dispatchEveCopy(ownerId, f.saved.conversation.id, noDispatch)
  ).toEqual(bound);
  expect(noDispatch).not.toHaveBeenCalled();
  expect(operations).toEqual([
    f.saved.conversation.id,
    f.saved.conversation.id,
  ]);
  expect(
    (await getEveCopyOperation(ownerId, f.input.operationId))?.copy
  ).toMatchObject({ phase: "bound", plan: null, seed: null });
  await expect(
    rejectUnacceptedEveCopy(ownerId, f.saved.conversation.id)
  ).rejects.toThrow("Accepted copies");
});

test("revocation before acceptance prevents dispatch and permits a never-dispatched cleanup", async () => {
  const f = await fixture();
  await prepare(f);
  await db
    .update(eveConversation)
    .set({ visibility: "private" })
    .where(eq(eveConversation.id, f.sourceId));
  await expect(acceptEveCopy(ownerId, f.saved.conversation.id)).rejects.toThrow(
    "revoked"
  );
  expect(
    await rejectUnacceptedEveCopy(ownerId, f.saved.conversation.id)
  ).toEqual({ id: f.saved.conversation.id, neverDispatched: true });
  await expect(
    writeEveCopyFile(ownerId, f.saved.conversation.id, f.targetKey, f.storage)
  ).rejects.toThrow("unavailable");
  await expect(
    dispatchEveCopy(ownerId, f.saved.conversation.id, () =>
      Promise.resolve("forbidden")
    )
  ).rejects.toThrow();
  await purgeEveFamilyDocuments(ownerId, f.saved.conversation.id);
  await db
    .delete(eveFileReference)
    .where(eq(eveFileReference.conversationId, f.saved.conversation.id));
  await completeEveConversationDeletion(ownerId, f.saved.conversation.id);
  expect(
    await db
      .select()
      .from(eveConversationCopy)
      .where(eq(eveConversationCopy.conversationId, f.saved.conversation.id))
  ).toEqual([]);
  const [tombstone] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, f.saved.conversation.id));
  expect(tombstone).toMatchObject({
    creationKind: "copy",
    firstMessage: "",
    state: "deleted",
  });
  await expect(reserveEveCopyOperation(ownerId, f.input)).rejects.toThrow();
});

test("foreign owners cannot write resources, accept, reject, resolve, or dispatch a copy", async () => {
  const f = await fixture();
  const { id } = f.saved.conversation;
  await expect(
    writeEveCopyFile(sourceOwnerId, id, f.targetKey, f.storage)
  ).rejects.toThrow("not found");
  await expect(writeEveCopyDocuments(sourceOwnerId, id)).rejects.toThrow(
    "not found"
  );
  await expect(acceptEveCopy(sourceOwnerId, id)).rejects.toThrow("not found");
  await expect(rejectUnacceptedEveCopy(sourceOwnerId, id)).rejects.toThrow(
    "not found"
  );
  await expect(resolveAcceptedEveCopySeed(sourceOwnerId, id)).rejects.toThrow(
    "not found"
  );
  await expect(
    dispatchEveCopy(sourceOwnerId, id, () => Promise.resolve("forbidden"))
  ).rejects.toThrow("not found");
  expect(f.storage.writeDestinationFile).not.toHaveBeenCalled();
});

test("invalid initial native seeds never reserve resources or become accepted", async () => {
  for (const seed of [
    { attachments: "channel", messages: [] },
    { attachments: "channel", messages: [{ parts: [], role: "user" }] },
    {
      attachments: "channel",
      messages: [
        {
          parts: [{ type: "text", text: "x".repeat(8 * 1024 * 1024) }],
          role: "user",
        },
      ],
    },
  ] satisfies EveCopyPlan["seed"][]) {
    const operationId = crypto.randomUUID();
    await expect(
      reserveEveCopyOperation(ownerId, {
        modelId: "google/gemini-2.5-flash-lite",
        operationId,
        plan: {
          documentCheckpoints: [{ messageIndex: 0, heads: [] }],
          documents: [],
          files: [],
          seed,
          sourceHeads: [],
        },
        projectionHash: sha256,
        sourceConversationId: crypto.randomUUID(),
        sourceOwnerId,
        sourceSessionId: crypto.randomUUID(),
        title: "Invalid seed",
      })
    ).rejects.toThrow(invalidSeedError);
    expect(await getEveCopyOperation(ownerId, operationId)).toBeUndefined();
  }
});

test("document changes before acceptance leave the copy rejectable", async () => {
  const f = await fixture();
  await prepare(f);
  const nextRevision = crypto.randomUUID();
  await db.insert(eveDocumentRevision).values({
    content: "New published revision",
    conversationId: f.sourceId,
    documentId: f.sourceDocumentId,
    id: nextRevision,
    kind: "text",
    operationId: "changed",
    ownerId: sourceOwnerId,
    parentRevisionId: f.sourceRevisionId,
    title: "Changed",
  });
  await db
    .update(eveDocumentHead)
    .set({ revisionId: nextRevision })
    .where(eq(eveDocumentHead.documentId, f.sourceDocumentId));
  await expect(acceptEveCopy(ownerId, f.saved.conversation.id)).rejects.toThrow(
    "Published document history changed"
  );
  await expect(
    rejectUnacceptedEveCopy(ownerId, f.saved.conversation.id)
  ).resolves.toMatchObject({ neverDispatched: true });
});

test("concurrent accepted retries dispatch once and return the same binding", async () => {
  const f = await fixture();
  await prepare(f);
  await acceptEveCopy(ownerId, f.saved.conversation.id);
  const started = Promise.withResolvers<undefined>();
  const finish = Promise.withResolvers<string>();
  const create = vi.fn(() => {
    started.resolve(undefined);
    return finish.promise;
  });
  const first = dispatchEveCopy(ownerId, f.saved.conversation.id, create);
  await started.promise;
  try {
    await expect(
      dispatchEveCopy(ownerId, f.saved.conversation.id, create)
    ).rejects.toThrow("Copy creation is still in progress");
  } finally {
    finish.resolve("concurrent-native-session");
  }
  const bound = await first;
  expect(
    await dispatchEveCopy(ownerId, f.saved.conversation.id, create)
  ).toEqual(bound);
  expect(create).toHaveBeenCalledTimes(1);
});

test("commits an empty imported document boundary together with copied resources", async () => {
  const f = await fixture();
  await prepare(f);
  expect(
    await db
      .select()
      .from(eveImportedDocumentCheckpoint)
      .where(
        eq(
          eveImportedDocumentCheckpoint.conversationId,
          f.saved.conversation.id
        )
      )
  ).toEqual([
    { conversationId: f.saved.conversation.id, messageIndex: 0, ownerId },
  ]);
  expect(
    await db
      .select()
      .from(eveImportedDocumentCheckpointEntry)
      .where(
        eq(
          eveImportedDocumentCheckpointEntry.conversationId,
          f.saved.conversation.id
        )
      )
  ).toEqual([]);
});
