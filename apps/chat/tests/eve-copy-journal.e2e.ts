import { createHash, randomBytes } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";
import { createEveTestSession } from "./eve-native-session.fixture";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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
const invalidBoundaryError = /boundaries must match imported user messages/u;
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
  /* oxlint-disable eslint/no-await-in-loop -- Delete copy files and checkpoint entries before their headers, documents and conversation parents. */
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
  /* oxlint-enable eslint/no-await-in-loop */
  await db.delete(user).where(inArray(user.id, owners));
});
const bytes = Buffer.from("public fixture");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const key = (): string => randomBytes(18).toString("base64url");

const fixture = async () => {
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
            fileIds: [],
            content: `Image: /api/files/${targetKey}`,
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
              url: `https://chatjs.example/api/files/${targetKey}`,
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
    readSourceFile: vi
      .fn()
      .mockResolvedValue(new Blob([bytes], { type: "image/png" })),
    writeDestinationFile: vi
      .fn<(_key: string, _file: Readonly<Blob>) => Promise<void>>()
      .mockResolvedValue(),
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
};

const prepare = async (
  ctx: Readonly<{
    saved: Readonly<{ conversation: Readonly<{ id: string }> }>;
    targetKey: string;
    storage: Readonly<{
      readSourceFile: (
        key: string
      ) => Promise<Pick<Blob, "type" | "arrayBuffer">>;
      writeDestinationFile: (
        key: string,
        file: Readonly<Blob>
      ) => Promise<void>;
    }>;
  }>
): Promise<void> => {
  await writeEveCopyFile(
    ownerId,
    ctx.saved.conversation.id,
    ctx.targetKey,
    ctx.storage
  );
  await writeEveCopyDocuments(ownerId, ctx.saved.conversation.id);
};

test("reserves one immutable root and destination resources before writes, rejecting changed intent and cross-kind replay", async () => {
  const ctx = await fixture();
  const replay = await Promise.all(
    Array.from(
      { length: 3 },
      async () => await reserveEveCopyOperation(ownerId, ctx.input)
    )
  );
  expect(
    replay.map(
      (row: Readonly<{ conversation: Readonly<{ id: string }> }>) =>
        row.conversation.id
    )
  ).toEqual(Array.from({ length: 3 }, () => ctx.saved.conversation.id));
  expect(ctx.saved.conversation).toMatchObject({
    creationKind: "copy",
    parentConversationId: null,
    rootConversationId: null,
    sessionId: null,
  });
  expect(ctx.storage.writeDestinationFile).not.toHaveBeenCalled();
  const [reference] = await db
    .select()
    .from(eveFileReference)
    .where(eq(eveFileReference.conversationId, ctx.saved.conversation.id));
  expect(reference).toMatchObject({ key: ctx.targetKey, ownerId });
  await expect(
    reserveEveCopyOperation(ownerId, {
      ...ctx.input,
      plan: {
        ...ctx.input.plan,
        seed: { ...ctx.input.plan.seed, messages: [] },
      },
    })
  ).rejects.toThrow();
  const create = vi
    .fn<() => Promise<string>>()
    .mockResolvedValue("wrong namespace");
  await expect(
    createEveConversation(
      ownerId,
      ctx.input.operationId,
      ctx.input.title,
      create
    )
  ).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
  const messageOperation = crypto.randomUUID();
  await createEveConversation(
    ownerId,
    messageOperation,
    "Normal",
    createEveTestSession
  );
  await expect(
    reserveEveCopyOperation(ownerId, {
      ...ctx.input,
      operationId: messageOperation,
    })
  ).rejects.toThrow("ordinary message");
});

test("cannot accept or expose a native seed before file and document receipts commit", async () => {
  const ctx = await fixture();
  const { id } = ctx.saved.conversation;
  await expect(acceptEveCopy(ownerId, id)).rejects.toThrow("documents");
  await expect(resolveAcceptedEveCopySeed(ownerId, id)).rejects.toThrow();
  const create = vi
    .fn<() => Promise<string>>()
    .mockResolvedValue("not allowed");
  await expect(dispatchEveCopy(ownerId, id, create)).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
  await writeEveCopyDocuments(ownerId, id);
  await expect(acceptEveCopy(ownerId, id)).rejects.toThrow("file writes");
  ctx.storage.readSourceFile.mockResolvedValueOnce(
    new Blob(["changed bytes"], { type: "image/png" })
  );
  await expect(
    writeEveCopyFile(ownerId, id, ctx.targetKey, ctx.storage)
  ).rejects.toThrow("changed after preparation");
  expect(ctx.storage.writeDestinationFile).not.toHaveBeenCalled();
  await prepare(ctx);
  expect(await acceptEveCopy(ownerId, id)).toBe("accepted");
  expect(await resolveAcceptedEveCopySeed(ownerId, id)).toEqual(
    ctx.input.plan.seed
  );
  const unplanned = await getEveCopyOperation(ownerId, ctx.input.operationId);
  expect(unplanned?.copy.plan).toBeNull();
});

test("an uncertain file write retries the same allocated key and records completion once", async () => {
  const ctx = await fixture();
  ctx.storage.writeDestinationFile.mockRejectedValueOnce(
    new Error("Lost storage response")
  );
  await expect(
    writeEveCopyFile(
      ownerId,
      ctx.saved.conversation.id,
      ctx.targetKey,
      ctx.storage
    )
  ).rejects.toThrow("Lost storage");
  const [pending] = await db
    .select()
    .from(eveConversationCopyFile)
    .where(
      eq(eveConversationCopyFile.conversationId, ctx.saved.conversation.id)
    );
  expect(pending.writtenAt).toBeNull();
  await writeEveCopyFile(
    ownerId,
    ctx.saved.conversation.id,
    ctx.targetKey,
    ctx.storage
  );
  await writeEveCopyFile(
    ownerId,
    ctx.saved.conversation.id,
    ctx.targetKey,
    ctx.storage
  );
  expect(
    ctx.storage.writeDestinationFile.mock.calls.map(
      (call: ReadonlyNativeSurface<readonly [string, Blob]>) => call[0]
    )
  ).toEqual([ctx.targetKey, ctx.targetKey]);
});

test("accepted copies recover after source revocation and a lost native reply, then discard temporary transcript data", async () => {
  const ctx = await fixture();
  await prepare(ctx);
  await acceptEveCopy(ownerId, ctx.saved.conversation.id);
  await db
    .update(eveConversation)
    .set({ state: "deleting", visibility: "private" })
    .where(eq(eveConversation.id, ctx.sourceId));
  const nativeId = crypto.randomUUID();
  const operations: string[] = [];
  await expect(
    dispatchEveCopy(
      ownerId,
      ctx.saved.conversation.id,
      /* oxlint-disable typescript/promise-function-async -- This immediate fixture returns a settled promise without asynchronous work; an async wrapper conflicts with require-await. */
      (operation) => {
        operations.push(operation);
        return Promise.reject(new Error("Lost native response"));
      }
      /* oxlint-enable typescript/promise-function-async */
    )
  ).rejects.toThrow("Lost native");
  const uncertain = await getEveCopyOperation(ownerId, ctx.input.operationId);
  expect(uncertain?.conversation.state).toBe("uncertain");
  expect(
    await resolveAcceptedEveCopySeed(ownerId, ctx.saved.conversation.id)
  ).toEqual(ctx.input.plan.seed);
  const bound = await dispatchEveCopy(
    ownerId,
    ctx.saved.conversation.id,
    /* oxlint-disable typescript/promise-function-async -- This immediate fixture returns a settled promise without asynchronous work; an async wrapper conflicts with require-await. */
    (operation) => {
      operations.push(operation);
      return Promise.resolve(nativeId);
    }
    /* oxlint-enable typescript/promise-function-async */
  );
  const noDispatch = vi
    .fn<() => Promise<string>>()
    .mockResolvedValue("duplicate");
  expect(
    await dispatchEveCopy(ownerId, ctx.saved.conversation.id, noDispatch)
  ).toEqual(bound);
  expect(noDispatch).not.toHaveBeenCalled();
  expect(operations).toEqual([
    ctx.saved.conversation.id,
    ctx.saved.conversation.id,
  ]);
  const journal = await getEveCopyOperation(ownerId, ctx.input.operationId);
  expect(journal?.copy).toMatchObject({
    phase: "bound",
    plan: null,
    seed: null,
  });
  await expect(
    rejectUnacceptedEveCopy(ownerId, ctx.saved.conversation.id)
  ).rejects.toThrow("Accepted copies");
});

test("revocation before acceptance prevents dispatch and permits a never-dispatched cleanup", async () => {
  const ctx = await fixture();
  await prepare(ctx);
  await db
    .update(eveConversation)
    .set({ visibility: "private" })
    .where(eq(eveConversation.id, ctx.sourceId));
  await expect(
    acceptEveCopy(ownerId, ctx.saved.conversation.id)
  ).rejects.toThrow("revoked");
  expect(
    await rejectUnacceptedEveCopy(ownerId, ctx.saved.conversation.id)
  ).toEqual({ id: ctx.saved.conversation.id, neverDispatched: true });
  await expect(
    writeEveCopyFile(
      ownerId,
      ctx.saved.conversation.id,
      ctx.targetKey,
      ctx.storage
    )
  ).rejects.toThrow("unavailable");
  await expect(
    dispatchEveCopy(
      ownerId,
      ctx.saved.conversation.id,
      vi.fn<() => Promise<string>>().mockResolvedValue("forbidden")
    )
  ).rejects.toThrow();
  await purgeEveFamilyDocuments(ownerId, ctx.saved.conversation.chatId);
  await db
    .delete(eveFileReference)
    .where(eq(eveFileReference.conversationId, ctx.saved.conversation.id));
  await completeEveConversationDeletion(ownerId, ctx.saved.conversation.id);
  expect(
    await db
      .select()
      .from(eveConversationCopy)
      .where(eq(eveConversationCopy.conversationId, ctx.saved.conversation.id))
  ).toEqual([]);
  const [tombstone] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, ctx.saved.conversation.id));
  expect(tombstone).toMatchObject({
    creationKind: "copy",
    firstMessage: "",
    state: "deleted",
  });
  await expect(reserveEveCopyOperation(ownerId, ctx.input)).rejects.toThrow();
});

test("foreign owners cannot write resources, accept, reject, resolve, or dispatch a copy", async () => {
  const ctx = await fixture();
  const { id } = ctx.saved.conversation;
  await expect(
    writeEveCopyFile(sourceOwnerId, id, ctx.targetKey, ctx.storage)
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
    dispatchEveCopy(
      sourceOwnerId,
      id,
      vi.fn<() => Promise<string>>().mockResolvedValue("forbidden")
    )
  ).rejects.toThrow("not found");
  expect(ctx.storage.writeDestinationFile).not.toHaveBeenCalled();
});

test("invalid native seeds or document boundaries never reserve resources", async () => {
  await Promise.all(
    (
      [
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
      ] satisfies EveCopyPlan["seed"][]
    ).map(async (seed) => {
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
      ).rejects.toThrow(
        seed.messages.length > 0 ? invalidSeedError : invalidBoundaryError
      );
      expect(await getEveCopyOperation(ownerId, operationId)).toBeUndefined();
    })
  );
});

test("document changes before acceptance leave the copy rejectable", async () => {
  const ctx = await fixture();
  await prepare(ctx);
  const nextRevision = crypto.randomUUID();
  await db.insert(eveDocumentRevision).values({
    content: "New published revision",
    conversationId: ctx.sourceId,
    documentId: ctx.sourceDocumentId,
    id: nextRevision,
    kind: "text",
    operationId: "changed",
    ownerId: sourceOwnerId,
    parentRevisionId: ctx.sourceRevisionId,
    title: "Changed",
  });
  await db
    .update(eveDocumentHead)
    .set({ revisionId: nextRevision })
    .where(eq(eveDocumentHead.documentId, ctx.sourceDocumentId));
  await expect(
    acceptEveCopy(ownerId, ctx.saved.conversation.id)
  ).rejects.toThrow("Published document history changed");
  await expect(
    rejectUnacceptedEveCopy(ownerId, ctx.saved.conversation.id)
  ).resolves.toMatchObject({ neverDispatched: true });
});

test("concurrent accepted retries dispatch once and return the same binding", async () => {
  const ctx = await fixture();
  await prepare(ctx);
  await acceptEveCopy(ownerId, ctx.saved.conversation.id);
  const started = Promise.withResolvers<undefined>();
  const finish = Promise.withResolvers<string>();
  const create = vi.fn(async () => {
    // oxlint-disable-next-line unicorn/no-useless-undefined -- The Promise<undefined> resolver requires its explicit completion value.
    started.resolve(undefined);
    return await finish.promise;
  });
  const first = dispatchEveCopy(ownerId, ctx.saved.conversation.id, create);
  await started.promise;
  try {
    await expect(
      dispatchEveCopy(ownerId, ctx.saved.conversation.id, create)
    ).rejects.toThrow("Copy creation is still in progress");
  } finally {
    finish.resolve("concurrent-native-session");
  }
  const bound = await first;
  expect(
    await dispatchEveCopy(ownerId, ctx.saved.conversation.id, create)
  ).toEqual(bound);
  expect(create).toHaveBeenCalledTimes(1);
});

test("commits an empty imported document boundary together with copied resources", async () => {
  const ctx = await fixture();
  await prepare(ctx);
  expect(
    await db
      .select()
      .from(eveImportedDocumentCheckpoint)
      .where(
        eq(
          eveImportedDocumentCheckpoint.conversationId,
          ctx.saved.conversation.id
        )
      )
  ).toEqual([
    {
      conversationId: ctx.saved.conversation.id,
      messageIndex: 0,
      ownerId,
    },
  ]);
  expect(
    await db
      .select()
      .from(eveImportedDocumentCheckpointEntry)
      .where(
        eq(
          eveImportedDocumentCheckpointEntry.conversationId,
          ctx.saved.conversation.id
        )
      )
  ).toEqual([]);
});
