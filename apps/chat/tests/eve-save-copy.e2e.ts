/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:crypto" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import { randomBytes } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-copy-dispatch"; "../lib/db/eve-copy-journal"; "../lib/db/eve-queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
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
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);
const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  files: new Map<string, Blob>(),
  model: vi.fn(),
  native: new Map<string, { sessionId: string; seed: EveCopySeed }>(),
  remove: vi.fn(),
  request: vi.fn(),
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
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): vi.mock("../lib/file-storage") uses 0, 24 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
vi.mock("../lib/file-storage", () => ({
  createFileId: (): string =>
    crypto.randomUUID().replaceAll("-", "").slice(0, 24),
  deleteFilesByUrls: mocks.remove,
  downloadFile: mocks.download,
  uploadFileAtKey: mocks.upload,
}));
/* oxlint-enable no-magic-numbers */

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
/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-statements (#512): beforeEach keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): beforeEach uses -1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): beforeEach accepts urls: string[]; file: Blob; init?: RequestInit; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): beforeEach preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): beforeEach intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
      if (path.startsWith("/eve/chat/v1/operation/")) {
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
});
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type --
 * max-lines-per-function (#510): fixture keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): fixture keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): fixture uses 18, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep fixture's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
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
}
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type */

/* oxlint-disable id-length, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * id-length (#506): test("saves a complete independent copy, including inline bytes and files only in old uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-lines-per-function (#510): test("saves a complete independent copy, including inline bytes and files only in old keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("saves a complete independent copy, including inline bytes and files only in old keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("saves a complete independent copy, including inline bytes and files only in old uses 2, -1, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("saves a complete independent copy, including inline bytes and files only in old accepts revision; receipt; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): test("saves a complete independent copy, including inline bytes and files only in old preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable id-length, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable id-length, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * id-length (#506): test("a lost native reply recovers without reopening or reading a revoked source") uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-statements (#512): test("a lost native reply recovers without reopening or reading a revoked source") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a lost native reply recovers without reopening or reading a revoked source") uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("a lost native reply recovers without reopening or reading a revoked source") accepts ...args; call; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("a lost native reply recovers without reopening or reading a revoked source", async () => {
  const f = await fixture();
  const original = mocks.request.getMockImplementation();
  if (!original) {
    throw new Error("Missing native fixture");
  }
  mocks.request.mockImplementation(async (...args) => {
    // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-assignment -- Wrap the captured native request mock without narrowing its overloads so the scenario can alter only the session reply.
    const response = await original(...args);
    if (args[1] === "/eve/chat/v1/session") {
      throw new Error("Lost native reply");
    }
    // oxlint-disable-next-line typescript/no-unsafe-return -- Wrap the captured native request mock without narrowing its overloads so the scenario can alter only the session reply.
    return response;
  });
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Lost native reply");
  const operation = await getEveCopyOperation(ownerId, f.input.operationId);
  expect(operation?.conversation.state).toBe("uncertain");
  await db
    .update(eveConversation)
    .set({ state: "deleting", visibility: "private" })
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
    mocks.request.mock.calls.filter(
      (call) => call[1] === "/eve/chat/v1/session"
    )
  ).toHaveLength(1);
});
/* oxlint-enable id-length, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length --
 * id-length (#506): test("unrelated private file references are denied before any bytes or destination re uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
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
/* oxlint-enable id-length */

/* oxlint-disable id-length, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * id-length (#506): test("uncertain storage writes retry persisted keys without taking another snapshot o uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-magic-numbers (#517): test("uncertain storage writes retry persisted keys without taking another snapshot o uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("uncertain storage writes retry persisted keys without taking another snapshot o accepts file: Blob; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("uncertain storage writes retry persisted keys without taking another snapshot o preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
/* oxlint-enable id-length, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable id-length, no-magic-numbers --
 * id-length (#506): test("an unavailable native lookup leaves acceptance recoverable and never blindly di uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-magic-numbers (#517): test("an unavailable native lookup leaves acceptance recoverable and never blindly di uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("an unavailable native lookup leaves acceptance recoverable and never blindly dispatches", async () => {
  const f = await fixture();
  mocks.request.mockResolvedValue(
    Response.json({ error: "Unavailable" }, { status: 503 })
  );
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Native copy lookup is unavailable");
  const awaitedMemberValue1 = await getEveCopyOperation(
    ownerId,
    f.input.operationId
  );
  expect(awaitedMemberValue1?.copy.phase).toBe("accepted");
  expect(mocks.request).toHaveBeenCalledTimes(1);
  expect(mocks.native.size).toBe(0);
});
/* oxlint-enable id-length, no-magic-numbers */

/* oxlint-disable id-length, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * id-length (#506): test("concurrent requests converge on the persisted allocation and one native copy") uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-magic-numbers (#517): test("concurrent requests converge on the persisted allocation and one native copy") uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("concurrent requests converge on the persisted allocation and one native copy") accepts attempt; call; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("concurrent requests converge on the persisted allocation and one native copy") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
    mocks.request.mock.calls.filter(
      (call) => call[1] === "/eve/chat/v1/session"
    )
  ).toHaveLength(1);
});
/* oxlint-enable id-length, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable id-length, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null --
 * id-length (#506): test("revocation before acceptance purges only the rejected destination and keeps a r uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-statements (#512): test("revocation before acceptance purges only the rejected destination and keeps a r keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("revocation before acceptance purges only the rejected destination and keeps a r uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("revocation before acceptance purges only the rejected destination and keeps a r accepts file: Blob; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("revocation before acceptance purges only the rejected destination and keeps a r preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): test("revocation before acceptance purges only the rejected destination and keeps a r preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
    creationKind: "copy",
    sessionId: null,
    state: "deleted",
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
/* oxlint-enable id-length, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null */

/* oxlint-disable id-length, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * id-length (#506): test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-statements (#512): test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure accepts file: Blob; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
  const awaitedMemberValue2 = await getEveCopyOperation(
    ownerId,
    f.input.operationId
  );
  expect(awaitedMemberValue2?.copy.phase).toBe("rejected");
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("copy was rejected");
  expect(await getEveCreation(ownerId, f.input.operationId)).toMatchObject({
    creationKind: "copy",
    state: "deleted",
  });
  expect(mocks.request).not.toHaveBeenCalled();
  expect(mocks.source).toHaveBeenCalledTimes(1);
  expect(mocks.files.size).toBe(1);
});
/* oxlint-enable id-length, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable id-length --
 * id-length (#506): test("deletion of an unwritten source file rejects preparation before another storage uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
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
    .set({ state: "deleted", visibility: "private" })
    .where(eq(eveConversation.id, f.source.id));
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Sharing was revoked");
  expect(mocks.download).toHaveBeenCalledTimes(reads);
  expect(await getEveCreation(ownerId, f.input.operationId)).toMatchObject({
    creationKind: "copy",
    state: "deleted",
  });
  expect(mocks.request).not.toHaveBeenCalled();
});
/* oxlint-enable id-length */

/* oxlint-disable id-length, no-undefined --
 * id-length (#506): test("a definitive model rejection tombstones the operation but transient catalog fai uses f as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-undefined (#519): test("a definitive model rejection tombstones the operation but transient catalog fai uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test("a definitive model rejection tombstones the operation but transient catalog failures remain retryable", async () => {
  const f = await fixture();
  mocks.model.mockRejectedValueOnce(new Error("Catalog unavailable"));
  await expect(
    saveEveCopyOperation(ownerId, f.input, "https://chatjs.example")
  ).rejects.toThrow("Catalog unavailable");
  expect(await getEveCreation(ownerId, f.input.operationId)).toBeUndefined();
  mocks.model.mockRejectedValueOnce(
    new EveModelUnavailableError("Model removed")
  );
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
/* oxlint-enable id-length, no-undefined */

/* oxlint-disable max-lines -- #509: This eve-save-copy.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
