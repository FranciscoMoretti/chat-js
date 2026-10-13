import { randomBytes } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";

import { db } from "../lib/db/client";
import { resolveAcceptedEveCopySeed } from "../lib/db/eve-copy-dispatch";
import { getEveCopyOperation } from "../lib/db/eve-copy-journal";
import { getEveCreation } from "../lib/db/eve-queries";
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
import type { EveCopySeed } from "../lib/eve/copy-journal-contract";
import { prepareEveCopyTranscript } from "../lib/eve/copy-transcript";
import { EveModelUnavailableError } from "../lib/eve/model-selection";
import { saveEveCopyOperation } from "../lib/eve/save-copy-operation";
import { keyFromFileUrl } from "../lib/file-url";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  files: new Map<string, Blob>(),
  model: vi.fn<() => Promise<void>>(),
  native: new Map<string, { sessionId: string; seed: EveCopySeed }>(),
  remove: vi.fn(),
  request:
    vi.fn<
      (
        owner: string,
        path: string,
        init?: { readonly body?: unknown },
        modelId?: string
      ) => Promise<Response>
    >(),
  source: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../lib/eve/public-copy-source", () => ({
  readPublicEveCopySource: mocks.source,
}));
vi.mock("../lib/eve/model-selection", () => ({
  EveModelUnavailableError: class extends Error {},
  loadEveModelDefinition: mocks.model,
}));
vi.mock("../lib/eve/server", () => ({
  assertEveConfigured: vi.fn(),
  eveRequest: mocks.request,
}));
vi.mock("../lib/file-storage", () => ({
  createFileId: (): string =>
    crypto.randomUUID().replaceAll("-", "").slice(0, 24),
  deleteFilesByUrls: mocks.remove,
  downloadFile: mocks.download,
  uploadFileAtKey: mocks.upload,
}));

const ownerId = crypto.randomUUID();
const sourceOwnerId = crypto.randomUUID();
const owners = [ownerId, sourceOwnerId];
const modelId = "google/gemini-2.5-flash-lite";
await db.insert(user).values(
  owners.map((id) => ({
    email: `${id}@test.invalid`,
    id,
    name: "Save copy fixture",
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
const installNativeCopyRequestMock = (): void => {
  mocks.request.mockImplementation(
    async (owner: string, path: string, init?: { readonly body?: unknown }) => {
      if (path.startsWith("/eve/chat/v1/operation/")) {
        const url = new URL(path, "http://fixture.invalid");
        if (url.searchParams.get("kind") !== "seed") {
          throw new Error("Wrong native operation namespace");
        }
        const operationId = url.pathname.split("/").at(-1);
        const saved = mocks.native.get(`${owner}/${operationId}`);
        if (saved) {
          return Response.json({ sessionId: saved.sessionId });
        }
        return Response.json(
          { code: "eve_operation_not_found" },
          { status: 404 }
        );
      }
      if (typeof init?.body !== "string") {
        throw new TypeError("Expected a JSON copy request body");
      }
      const body = z
        .strictObject({ operationId: z.uuid(), seed: z.literal(true) })
        .parse(JSON.parse(init.body));
      const seed = await resolveAcceptedEveCopySeed(owner, body.operationId);
      const native = { seed, sessionId: crypto.randomUUID() };
      mocks.native.set(`${owner}/${body.operationId}`, native);
      return Response.json({ sessionId: native.sessionId });
    }
  );
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.files.clear();
  mocks.native.clear();
  mocks.remove.mockImplementation(
    /* oxlint-disable typescript/promise-function-async -- The Promise-only storage fixture removes the requested keys from the in-memory inventory; eslint/require-await rejects an immediate async callback with no storage I/O. */
    (urls: readonly string[]) => {
      for (const url of urls) {
        const key = keyFromFileUrl(url);
        if (key !== undefined && key !== null && key !== "") {
          mocks.files.delete(key);
        }
      }
      return Promise.resolve();
    }
    /* oxlint-enable typescript/promise-function-async */
  );
  mocks.download.mockImplementation(
    /* oxlint-disable typescript/promise-function-async -- The Promise-only storage fixture looks up each requested Blob and rejects missing keys; a static result loses key validation, and eslint/require-await rejects an immediate async callback. */
    (key: string) => {
      const file = mocks.files.get(key);
      if (!file) {
        throw new Error("File missing");
      }
      return Promise.resolve(file);
    }
    /* oxlint-enable typescript/promise-function-async */
  );
  mocks.upload.mockImplementation(
    /* oxlint-disable typescript/promise-function-async -- The Promise-only storage fixture records each uploaded key and Blob for replay/cleanup checks; eslint/require-await rejects an immediate async callback with no storage I/O. */
    (key: string, _name: string, file: Readonly<Blob>) => {
      mocks.files.set(key, file);
      return Promise.resolve();
    }
    /* oxlint-enable typescript/promise-function-async */
  );
  installNativeCopyRequestMock();
});

const fixture = async () => {
  const source = {
    id: crypto.randomUUID(),
    ownerId: sourceOwnerId,
    sessionId: crypto.randomUUID(),
    title: "Shared with document",
  };
  const key = randomBytes(18).toString("base64url");
  const documentId = crypto.randomUUID();
  const first = crypto.randomUUID();
  const head = crypto.randomUUID();
  await insertEveConversationFixtures({
    ...source,
    firstMessage: source.title,
    operationId: crypto.randomUUID(),
    state: "bound",
    visibility: "public",
  });
  await db.insert(eveStoredFile).values({ key, ownerId: sourceOwnerId });
  await db
    .insert(eveFileReference)
    .values({ conversationId: source.id, key, ownerId: sourceOwnerId });
  await db.insert(eveDocumentRevision).values([
    {
      content: `/api/files/${key}`,
      conversationId: source.id,
      documentId,
      id: first,
      kind: "text",
      operationId: "first",
      ownerId: sourceOwnerId,
      title: "Published",
    },
    {
      content: "Current revision without image",
      conversationId: source.id,
      documentId,
      id: head,
      kind: "text",
      operationId: "head",
      ownerId: sourceOwnerId,
      parentRevisionId: first,
      title: "Published",
    },
  ]);
  await db.insert(eveDocumentHead).values({
    conversationId: source.id,
    documentId,
    ownerId: sourceOwnerId,
    revisionId: head,
  });
  mocks.files.set(key, new Blob(["document image"], { type: "image/png" }));
  const projection = prepareEveCopyTranscript([
    {
      data: {
        messages: [
          {
            id: "private-message",
            role: "user",
            parts: [
              { type: "text", text: "Explain" },
              {
                type: "file",
                url: "data:image/png;base64,aW5saW5l",
                mediaType: "image/png",
              },
            ],
          },
          {
            id: "private-answer",
            role: "assistant",
            parts: [
              {
                type: "dynamic-tool",
                toolName: "createTextDocument",
                toolCallId: "private-call",
                state: "output-available",
                input: {},
                output: { documentId, revisionId: head },
              },
              { type: "text", text: "Explanation", state: "done" },
            ],
          },
        ],
      },
      meta: { at: new Date(0).toISOString(), id: "history" },
      type: "history.seeded",
    },
    {
      data: { continuationToken: "private-token", wait: "next-user-message" },
      meta: { at: new Date(0).toISOString(), id: "idle" },
      type: "session.waiting",
    },
  ]);
  await db.insert(eveImportedDocumentCheckpoint).values({
    conversationId: source.id,
    messageIndex: 0,
    ownerId: sourceOwnerId,
  });
  mocks.source.mockResolvedValue({
    ...source,
    boundaries: [{ messageIndex: 0, sourceKind: "imported", sourceIndex: 0 }],
    projection,
  });
  return {
    documentId,
    first,
    head,
    input: {
      modelId,
      operationId: crypto.randomUUID(),
      sourceConversationId: source.id,
    },
    key,
    source,
  };
};

test("saves a complete independent copy, including inline bytes and files only in old document revisions", async () => {
  const fixtureData = await fixture();
  const bound = await saveEveCopyOperation(
    ownerId,
    fixtureData.input,
    "https://chatjs.example"
  );
  const operation = await getEveCopyOperation(
    ownerId,
    fixtureData.input.operationId
  );
  expect(operation?.copy).toMatchObject({
    phase: "bound",
    plan: null,
    seed: null,
  });
  const native = mocks.native.get(`${ownerId}/${bound.id}`);
  expect(native?.sessionId).toBe(bound.sessionId);
  expect(native?.seed.attachments).toBe("channel");
  const serialized = JSON.stringify(native?.seed);
  for (const privateValue of [
    fixtureData.source.sessionId,
    fixtureData.documentId,
    fixtureData.head,
    fixtureData.key,
    "private-message",
    "private-call",
    "private-token",
    "data:image",
  ]) {
    expect(serialized).not.toContain(privateValue);
  }
  const revisions = await db
    .select()
    .from(eveDocumentRevision)
    .where(eq(eveDocumentRevision.conversationId, bound.id));
  expect(revisions).toHaveLength(2);
  expect(
    revisions.every(
      (revision: Readonly<{ ownerId: string; turnIndex: number | null }>) =>
        revision.ownerId === ownerId && revision.turnIndex === null
    )
  ).toBe(true);
  const receipts = await db
    .select()
    .from(eveConversationCopyFile)
    .where(eq(eveConversationCopyFile.conversationId, bound.id));
  expect(receipts).toHaveLength(2);
  expect(
    receipts.every(
      (receipt: Readonly<{ key: string; writtenAt: unknown }>) =>
        receipt.writtenAt !== null && mocks.files.has(receipt.key)
    )
  ).toBe(true);
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(mocks.request.mock.calls.at(-1)?.[3]).toBe(modelId);
});

test("a lost native reply recovers without reopening or reading a revoked source", async () => {
  const fixtureData = await fixture();
  const original = mocks.request.getMockImplementation();
  if (!original) {
    throw new Error("Missing native fixture");
  }
  mocks.request.mockImplementation(
    async (...args: Parameters<typeof original>) => {
      const response = await original(...args);
      if (args[1] === "/eve/chat/v1/session") {
        throw new Error("Lost native reply");
      }

      return response;
    }
  );
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Lost native reply");
  const operation = await getEveCopyOperation(
    ownerId,
    fixtureData.input.operationId
  );
  expect(operation?.conversation.state).toBe("uncertain");
  await db
    .update(eveConversation)
    .set({ state: "deleting", visibility: "private" })
    .where(eq(eveConversation.id, fixtureData.source.id));
  mocks.files.delete(fixtureData.key);
  mocks.source.mockRejectedValue(new Error("Source revoked"));
  const bound = await saveEveCopyOperation(
    ownerId,
    fixtureData.input,
    "https://chatjs.example"
  );
  expect(bound.sessionId).toBe(
    mocks.native.get(`${ownerId}/${bound.id}`)?.sessionId
  );
  expect(mocks.source).toHaveBeenCalledTimes(1);
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(
    mocks.request.mock.calls.filter(
      (call: readonly unknown[]) => call[1] === "/eve/chat/v1/session"
    )
  ).toHaveLength(1);
});

test("unrelated private file references are denied before any bytes or destination resources are written", async () => {
  const fixtureData = await fixture();
  await db
    .delete(eveFileReference)
    .where(eq(eveFileReference.key, fixtureData.key));
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Published copy file is unavailable");
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
  expect(
    await getEveCopyOperation(ownerId, fixtureData.input.operationId)
  ).toBeUndefined();
});

test("uncertain storage writes retry persisted keys without taking another snapshot or making a second copy", async () => {
  const fixtureData = await fixture();
  mocks.upload.mockImplementationOnce(
    /* oxlint-disable typescript/promise-function-async -- This Promise-only storage fixture records the write before rejecting its lost reply, exercising uncertain persistence; eslint/require-await rejects an immediate async callback. */
    (key: string, _name: string, file: Readonly<Blob>) => {
      mocks.files.set(key, file);
      return Promise.reject(new Error("Lost storage reply"));
    }
    /* oxlint-enable typescript/promise-function-async */
  );
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Lost storage reply");
  const operation = await getEveCopyOperation(
    ownerId,
    fixtureData.input.operationId
  );
  const bound = await saveEveCopyOperation(
    ownerId,
    fixtureData.input,
    "https://chatjs.example"
  );
  expect(bound.id).toBe(operation?.conversation.id);
  expect(mocks.source).toHaveBeenCalledTimes(1);
  expect(mocks.upload.mock.calls[0][0]).toBe(mocks.upload.mock.calls[1][0]);
  expect(mocks.native.size).toBe(1);
  await expect(
    saveEveCopyOperation(
      ownerId,
      { ...fixtureData.input, sourceConversationId: crypto.randomUUID() },
      "https://chatjs.example"
    )
  ).rejects.toThrow("different source or model");
});

test("an unavailable native lookup leaves acceptance recoverable and never blindly dispatches", async () => {
  const fixtureData = await fixture();
  mocks.request.mockResolvedValue(
    Response.json({ error: "Unavailable" }, { status: 503 })
  );
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Native copy lookup is unavailable");
  const copyOperationAfterLookupFailure = await getEveCopyOperation(
    ownerId,
    fixtureData.input.operationId
  );
  expect(copyOperationAfterLookupFailure?.copy.phase).toBe("accepted");
  expect(mocks.request).toHaveBeenCalledTimes(1);
  expect(mocks.native.size).toBe(0);
});

test("concurrent requests converge on the persisted allocation and one native copy", async () => {
  const fixtureData = await fixture();
  const attempts = await Promise.allSettled(
    Array.from(
      { length: 3 },
      async () =>
        await saveEveCopyOperation(
          ownerId,
          fixtureData.input,
          "https://chatjs.example"
        )
    )
  );
  expect(
    attempts.some(
      (attempt: { readonly status: "rejected" | "fulfilled" }) =>
        attempt.status === "fulfilled"
    )
  ).toBe(true);
  const bound = await saveEveCopyOperation(
    ownerId,
    fixtureData.input,
    "https://chatjs.example"
  );
  for (const attempt of attempts) {
    if (attempt.status === "fulfilled") {
      expect(attempt.value).toEqual(bound);
    }
  }
  expect(mocks.native.size).toBe(1);
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(
    mocks.request.mock.calls.filter(
      (call: readonly unknown[]) => call[1] === "/eve/chat/v1/session"
    )
  ).toHaveLength(1);
});

test("revocation before acceptance purges only the rejected destination and keeps a replay tombstone", async () => {
  const fixtureData = await fixture();
  mocks.upload.mockImplementationOnce(
    /* oxlint-disable typescript/promise-function-async -- This Promise-only storage fixture persists the interrupted preparation before rejecting, so revocation must purge it; eslint/require-await rejects an immediate async callback. */
    (key: string, _name: string, file: Readonly<Blob>) => {
      mocks.files.set(key, file);
      return Promise.reject(new Error("Interrupted preparation"));
    }
    /* oxlint-enable typescript/promise-function-async */
  );
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Interrupted preparation");
  await db
    .update(eveConversation)
    .set({ visibility: "private" })
    .where(eq(eveConversation.id, fixtureData.source.id));
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Sharing was revoked");
  expect(
    await getEveCreation(ownerId, fixtureData.input.operationId)
  ).toMatchObject({
    creationKind: "copy",
    sessionId: null,
    state: "deleted",
  });
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(mocks.files.has(fixtureData.key)).toBe(true);
  expect(mocks.files.size).toBe(1);
  expect(mocks.request).not.toHaveBeenCalled();
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow();
  expect(mocks.source).toHaveBeenCalledTimes(1);
});

test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure", async () => {
  const fixtureData = await fixture();
  mocks.upload.mockImplementationOnce(
    /* oxlint-disable typescript/promise-function-async -- This Promise-only storage fixture persists interrupted preparation before rejecting, supplying the object for lost-cleanup recovery; eslint/require-await rejects an immediate async callback. */
    (key: string, _name: string, file: Readonly<Blob>) => {
      mocks.files.set(key, file);
      return Promise.reject(new Error("Interrupted preparation"));
    }
    /* oxlint-enable typescript/promise-function-async */
  );
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Interrupted preparation");
  await db
    .update(eveConversation)
    .set({ visibility: "private" })
    .where(eq(eveConversation.id, fixtureData.source.id));
  mocks.remove.mockRejectedValueOnce(new Error("Cleanup reply lost"));
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Cleanup reply lost");
  const copyOperationAfterLostCleanupReply = await getEveCopyOperation(
    ownerId,
    fixtureData.input.operationId
  );
  expect(copyOperationAfterLostCleanupReply?.copy.phase).toBe("rejected");
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("copy was rejected");
  expect(
    await getEveCreation(ownerId, fixtureData.input.operationId)
  ).toMatchObject({
    creationKind: "copy",
    state: "deleted",
  });
  expect(mocks.request).not.toHaveBeenCalled();
  expect(mocks.source).toHaveBeenCalledTimes(1);
  expect(mocks.files.size).toBe(1);
});

test("deletion of an unwritten source file rejects preparation before another storage read", async () => {
  const fixtureData = await fixture();
  mocks.upload.mockRejectedValueOnce(new Error("Interrupted preparation"));
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Interrupted preparation");
  const reads = mocks.download.mock.calls.length;
  mocks.files.delete(fixtureData.key);
  await db
    .update(eveConversation)
    .set({ state: "deleted", visibility: "private" })
    .where(eq(eveConversation.id, fixtureData.source.id));
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Sharing was revoked");
  expect(mocks.download).toHaveBeenCalledTimes(reads);
  expect(
    await getEveCreation(ownerId, fixtureData.input.operationId)
  ).toMatchObject({
    creationKind: "copy",
    state: "deleted",
  });
  expect(mocks.request).not.toHaveBeenCalled();
});
test("a definitive model rejection tombstones the operation but transient catalog failures remain retryable", async () => {
  const fixtureData = await fixture();
  mocks.model.mockRejectedValueOnce(new Error("Catalog unavailable"));
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Catalog unavailable");
  expect(
    await getEveCreation(ownerId, fixtureData.input.operationId)
  ).toBeUndefined();
  mocks.model.mockRejectedValueOnce(
    new EveModelUnavailableError("Model removed")
  );
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Model removed");
  expect(
    await getEveCreation(ownerId, fixtureData.input.operationId)
  ).toMatchObject({
    creationKind: "copy",
    state: "deleted",
  });
  mocks.model.mockResolvedValue();
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow();
  expect(mocks.source).not.toHaveBeenCalled();
});
