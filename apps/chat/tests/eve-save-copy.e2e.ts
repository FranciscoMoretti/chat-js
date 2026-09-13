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
import { EveModelUnavailable } from "../lib/eve/model-selection";
import { saveEveCopyOperation } from "../lib/eve/save-copy-operation";
import { keyFromFileUrl } from "../lib/file-url";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const mocks = vi.hoisted(() => ({
  source: vi.fn(),
  model: vi.fn(),
  request: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  files: new Map<string, Blob>(),
  native: new Map<string, { sessionId: string; seed: EveCopySeed }>(),
}));
vi.mock("../lib/eve/public-copy-source", () => ({
  readPublicEveCopySource: mocks.source,
}));
vi.mock("../lib/eve/model-selection", () => ({
  loadEveModelDefinition: mocks.model,
  EveModelUnavailable: class extends Error {},
}));
vi.mock("../lib/eve/server", () => ({
  assertEveConfigured: vi.fn(),
  eveRequest: mocks.request,
}));
vi.mock("../lib/file-storage", () => ({
  createFileStorageKey: () =>
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
    id,
    email: `${id}@test.invalid`,
    name: "Save copy fixture",
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
beforeEach(() => {
  vi.resetAllMocks();
  mocks.files.clear();
  mocks.native.clear();
  mocks.remove.mockImplementation((urls: string[]) => {
    for (const url of urls) {
      const key = keyFromFileUrl(url);
      if (key) {
        mocks.files.delete(key);
      }
    }
    return Promise.resolve();
  });
  mocks.download.mockImplementation((key: string) => {
    const file = mocks.files.get(key);
    if (!file) {
      throw new Error("File missing");
    }
    return Promise.resolve(file);
  });
  mocks.upload.mockImplementation((key: string, _name: string, file: Blob) => {
    mocks.files.set(key, file);
    return Promise.resolve();
  });
  mocks.request.mockImplementation(
    async (owner: string, path: string, init?: RequestInit) => {
      if (path.startsWith("/eve/v1/operation/")) {
        const url = new URL(path, "http://fixture.invalid");
        if (url.searchParams.get("kind") !== "seed") {
          throw new Error("Wrong native operation namespace");
        }
        const operationId = url.pathname.split("/").at(-1);
        const saved = mocks.native.get(`${owner}/${operationId}`);
        return saved
          ? Response.json({ sessionId: saved.sessionId })
          : Response.json({ code: "eve_operation_not_found" }, { status: 404 });
      }
      const body = z
        .strictObject({ seed: z.literal(true), operationId: z.uuid() })
        .parse(JSON.parse(String(init?.body)));
      const seed = await resolveAcceptedEveCopySeed(owner, body.operationId);
      const native = { sessionId: crypto.randomUUID(), seed };
      mocks.native.set(`${owner}/${body.operationId}`, native);
      return Response.json({ sessionId: native.sessionId });
    }
  );
});

async function fixture() {
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
  await db.insert(eveConversation).values({
    ...source,
    operationId: crypto.randomUUID(),
    firstMessage: source.title,
    state: "bound",
    visibility: "public",
  });
  await db.insert(eveStoredFile).values({ key, ownerId: sourceOwnerId });
  await db
    .insert(eveFileReference)
    .values({ key, ownerId: sourceOwnerId, conversationId: source.id });
  await db.insert(eveDocumentRevision).values([
    {
      id: first,
      documentId,
      conversationId: source.id,
      ownerId: sourceOwnerId,
      operationId: "first",
      title: "Published",
      content: `/api/files/content?key=${key}`,
      kind: "text",
    },
    {
      id: head,
      documentId,
      conversationId: source.id,
      ownerId: sourceOwnerId,
      operationId: "head",
      parentRevisionId: first,
      title: "Published",
      content: "Current revision without image",
      kind: "text",
    },
  ]);
  await db.insert(eveDocumentHead).values({
    conversationId: source.id,
    ownerId: sourceOwnerId,
    documentId,
    revisionId: head,
  });
  mocks.files.set(key, new Blob(["document image"], { type: "image/png" }));
  const projection = prepareEveCopyTranscript([
    {
      type: "history.seeded",
      meta: { id: "history", at: new Date(0).toISOString() },
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
    },
    {
      type: "session.waiting",
      meta: { id: "idle", at: new Date(0).toISOString() },
      data: { continuationToken: "private-token", wait: "next-user-message" },
    },
  ]);
  await db.insert(eveImportedDocumentCheckpoint).values({
    conversationId: source.id,
    ownerId: sourceOwnerId,
    messageIndex: 0,
  });
  mocks.source.mockResolvedValue({
    ...source,
    projection,
    boundaries: [{ messageIndex: 0, sourceKind: "imported", sourceIndex: 0 }],
  });
  return {
    source,
    key,
    documentId,
    first,
    head,
    input: {
      sourceConversationId: source.id,
      operationId: crypto.randomUUID(),
      modelId,
    },
  };
}

test("saves a complete independent copy, including inline bytes and files only in old document revisions", async () => {
  const f = await fixture();
  const bound = await saveEveCopyOperation(
    ownerId,
    f.input,
    "https://chatjs.example"
  );
  const operation = await getEveCopyOperation(ownerId, f.input.operationId);
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
    f.source.sessionId,
    f.documentId,
    f.head,
    f.key,
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
      (revision) => revision.ownerId === ownerId && revision.turnIndex === null
    )
  ).toBe(true);
  const receipts = await db
    .select()
    .from(eveConversationCopyFile)
    .where(eq(eveConversationCopyFile.conversationId, bound.id));
  expect(receipts).toHaveLength(2);
  expect(
    receipts.every(
      (receipt) => receipt.writtenAt !== null && mocks.files.has(receipt.key)
    )
  ).toBe(true);
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(mocks.request.mock.calls.at(-1)?.[3]).toBe(modelId);
});

test("a lost native reply recovers without reopening or reading a revoked source", async () => {
  const f = await fixture();
  const original = mocks.request.getMockImplementation();
  if (!original) {
    throw new Error("Missing native fixture");
  }
  mocks.request.mockImplementation(async (...args) => {
    const response = await original(...args);
    if (args[1] === "/eve/v1/session") {
      throw new Error("Lost native reply");
    }
    return response;
  });
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Lost native reply");
  const operation = await getEveCopyOperation(ownerId, f.input.operationId);
  expect(operation?.conversation.state).toBe("uncertain");
  await db
    .update(eveConversation)
    .set({ visibility: "private", state: "deleting" })
    .where(eq(eveConversation.id, f.source.id));
  mocks.files.delete(f.key);
  mocks.source.mockRejectedValue(new Error("Source revoked"));
  const bound = await saveEveCopyOperation(
    ownerId,
    f.input,
    "https://chatjs.example"
  );
  expect(bound.sessionId).toBe(
    mocks.native.get(`${ownerId}/${bound.id}`)?.sessionId
  );
  expect(mocks.source).toHaveBeenCalledTimes(1);
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(
    mocks.request.mock.calls.filter((call) => call[1] === "/eve/v1/session")
  ).toHaveLength(1);
});

test("unrelated private file references are denied before any bytes or destination resources are written", async () => {
  const f = await fixture();
  await db.delete(eveFileReference).where(eq(eveFileReference.key, f.key));
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Published copy file is unavailable");
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
  expect(
    await getEveCopyOperation(ownerId, f.input.operationId)
  ).toBeUndefined();
});

test("uncertain storage writes retry persisted keys without taking another snapshot or making a second copy", async () => {
  const f = await fixture();
  mocks.upload.mockImplementationOnce(
    (key: string, _name: string, file: Blob) => {
      mocks.files.set(key, file);
      return Promise.reject(new Error("Lost storage reply"));
    }
  );
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Lost storage reply");
  const operation = await getEveCopyOperation(ownerId, f.input.operationId);
  const bound = await saveEveCopyOperation(
    ownerId,
    f.input,
    "https://chatjs.example"
  );
  expect(bound.id).toBe(operation?.conversation.id);
  expect(mocks.source).toHaveBeenCalledTimes(1);
  expect(mocks.upload.mock.calls[0][0]).toBe(mocks.upload.mock.calls[1][0]);
  expect(mocks.native.size).toBe(1);
  await expect(
    saveEveCopyOperation(
      ownerId,
      { ...f.input, sourceConversationId: crypto.randomUUID() },
      "https://chatjs.example"
    )
  ).rejects.toThrow("different source or model");
});

test("an unavailable native lookup leaves acceptance recoverable and never blindly dispatches", async () => {
  const f = await fixture();
  mocks.request.mockResolvedValue(
    Response.json({ error: "Unavailable" }, { status: 503 })
  );
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Native copy lookup is unavailable");
  expect(
    (await getEveCopyOperation(ownerId, f.input.operationId))?.copy.phase
  ).toBe("accepted");
  expect(mocks.request).toHaveBeenCalledTimes(1);
  expect(mocks.native.size).toBe(0);
});

test("concurrent requests converge on the persisted allocation and one native copy", async () => {
  const f = await fixture();
  const attempts = await Promise.allSettled(
    Array.from({ length: 3 }, () =>
      saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
    )
  );
  expect(attempts.some((attempt) => attempt.status === "fulfilled")).toBe(true);
  const bound = await saveEveCopyOperation(
    ownerId,
    f.input,
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
    mocks.request.mock.calls.filter((call) => call[1] === "/eve/v1/session")
  ).toHaveLength(1);
});

test("revocation before acceptance purges only the rejected destination and keeps a replay tombstone", async () => {
  const f = await fixture();
  mocks.upload.mockImplementationOnce(
    (key: string, _name: string, file: Blob) => {
      mocks.files.set(key, file);
      return Promise.reject(new Error("Interrupted preparation"));
    }
  );
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Interrupted preparation");
  await db
    .update(eveConversation)
    .set({ visibility: "private" })
    .where(eq(eveConversation.id, f.source.id));
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Sharing was revoked");
  expect(await getEveCreation(ownerId, f.input.operationId)).toMatchObject({
    state: "deleted",
    creationKind: "copy",
    sessionId: null,
  });
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(mocks.files.has(f.key)).toBe(true);
  expect(mocks.files.size).toBe(1);
  expect(mocks.request).not.toHaveBeenCalled();
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow();
  expect(mocks.source).toHaveBeenCalledTimes(1);
});

test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure", async () => {
  const f = await fixture();
  mocks.upload.mockImplementationOnce(
    (key: string, _name: string, file: Blob) => {
      mocks.files.set(key, file);
      return Promise.reject(new Error("Interrupted preparation"));
    }
  );
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Interrupted preparation");
  await db
    .update(eveConversation)
    .set({ visibility: "private" })
    .where(eq(eveConversation.id, f.source.id));
  mocks.remove.mockRejectedValueOnce(new Error("Cleanup reply lost"));
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Cleanup reply lost");
  expect(
    (await getEveCopyOperation(ownerId, f.input.operationId))?.copy.phase
  ).toBe("rejected");
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("copy was rejected");
  expect(await getEveCreation(ownerId, f.input.operationId)).toMatchObject({
    state: "deleted",
    creationKind: "copy",
  });
  expect(mocks.request).not.toHaveBeenCalled();
  expect(mocks.source).toHaveBeenCalledTimes(1);
  expect(mocks.files.size).toBe(1);
});

test("deletion of an unwritten source file rejects preparation before another storage read", async () => {
  const f = await fixture();
  mocks.upload.mockRejectedValueOnce(new Error("Interrupted preparation"));
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Interrupted preparation");
  const reads = mocks.download.mock.calls.length;
  mocks.files.delete(f.key);
  await db
    .update(eveConversation)
    .set({ visibility: "private", state: "deleted" })
    .where(eq(eveConversation.id, f.source.id));
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Sharing was revoked");
  expect(mocks.download).toHaveBeenCalledTimes(reads);
  expect(await getEveCreation(ownerId, f.input.operationId)).toMatchObject({
    state: "deleted",
    creationKind: "copy",
  });
  expect(mocks.request).not.toHaveBeenCalled();
});

test("a definitive model rejection tombstones the operation but transient catalog failures remain retryable", async () => {
  const f = await fixture();
  mocks.model.mockRejectedValueOnce(new Error("Catalog unavailable"));
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Catalog unavailable");
  expect(await getEveCreation(ownerId, f.input.operationId)).toBeUndefined();
  mocks.model.mockRejectedValueOnce(new EveModelUnavailable("Model removed"));
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Model removed");
  expect(await getEveCreation(ownerId, f.input.operationId)).toMatchObject({
    creationKind: "copy",
    state: "deleted",
  });
  mocks.model.mockResolvedValue(undefined);
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow();
  expect(mocks.source).not.toHaveBeenCalled();
});
