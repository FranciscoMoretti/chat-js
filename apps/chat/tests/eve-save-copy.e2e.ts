/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:crypto" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import { randomBytes } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-copy-dispatch"; "../lib/db/eve-copy-journal"; "../lib/db/eve-queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { randomBytes } from "node:crypto";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eq, inArray } from "drizzle-orm";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { afterAll, beforeEach, expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
import { resolveAcceptedEveCopySeed } from "../lib/db/eve-copy-dispatch";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveCopyOperation } from "../lib/db/eve-copy-journal";
/* oxlint-enable sort-imports */
import { getEveCreation } from "../lib/db/eve-queries";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
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
/* oxlint-enable sort-imports */
import { env } from "../lib/env";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveCopySeed } from "../lib/eve/copy-journal-contract";
/* oxlint-enable sort-imports */
import { prepareEveCopyTranscript } from "../lib/eve/copy-transcript";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveModelUnavailableError } from "../lib/eve/model-selection";
/* oxlint-enable sort-imports */
import { saveEveCopyOperation } from "../lib/eve/save-copy-operation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { keyFromFileUrl } from "../lib/file-url";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
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
// oxlint-disable-next-line node/no-top-level-await -- This Bun database suite creates both owners before registering save-copy scenarios.
await db.insert(user).values(
  owners.map((id) => ({
    email: `${id}@test.invalid`,
    id,
    name: "Save copy fixture",
  }))
);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
const installNativeCopyRequestMock = (): void => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve mocks.request.mockImplementation's awaited sequencing and rejected-Promise behavior. */
  mocks.request.mockImplementation(
    // oxlint-disable-next-line max-statements -- The native copy request fixture models operation lookup and seed dispatch in one ordered 16-statement handler; preserve per-beforeEach handler allocation and mock state visibility.
    async (owner: string, path: string, init?: { readonly body?: unknown }) => {
      if (path.startsWith("/eve/chat/v1/operation/")) {
        const url = new URL(path, "http://fixture.invalid");
        if (url.searchParams.get("kind") !== "seed") {
          throw new Error("Wrong native operation namespace");
        }
        // oxlint-disable-next-line no-magic-numbers -- The operation identity is the final segment of the native operation lookup path.
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading body from init; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  /* oxlint-enable oxc/no-async-await */
};

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * typescript/prefer-readonly-parameter-types (#565): The remaining upload fixture receives file: Blob and stores that exact native file in the mutable Blob map; this original native-file parameter contract is outside the request-handler guard conversion.
 * typescript/promise-function-async (#606): beforeEach preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): beforeEach intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.files.clear();
  mocks.native.clear();
  mocks.remove.mockImplementation((urls: readonly string[]) => {
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
  installNativeCopyRequestMock();
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fixture's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing source own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing source own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * max-lines-per-function (#510): test("saves a complete independent copy, including inline bytes and files only in old keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("saves a complete independent copy, including inline bytes and files only in old keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("saves a complete independent copy, including inline bytes and files only in old uses 2, -1, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("saves a complete independent copy, including inline bytes and files only in old accepts revision; receipt; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): test("saves a complete independent copy, including inline bytes and files only in old preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading copy from operation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(operation?.copy).toMatchObject({
    phase: "bound",
    plan: null,
    seed: null,
  });
  const native = mocks.native.get(`${ownerId}/${bound.id}`);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from native; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(native?.sessionId).toBe(bound.sessionId);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading seed from native; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(native?.seed.attachments).toBe("channel");
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading seed from native; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 3 from mocks.request.mock.calls.at(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(mocks.request.mock.calls.at(-1)?.[3]).toBe(modelId);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("a lost native reply recovers without reopening or reading a revoked source") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a lost native reply recovers without reopening or reading a revoked source") uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("a lost native reply recovers without reopening or reading a revoked source") accepts ...args; call; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("a lost native reply recovers without reopening or reading a revoked source", async () => {
  const fixtureData = await fixture();
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
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow("Lost native reply");
  const operation = await getEveCopyOperation(
    ownerId,
    fixtureData.input.operationId
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading conversation from operation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from mocks.native.get(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): test("uncertain storage writes retry persisted keys without taking another snapshot o uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("uncertain storage writes retry persisted keys without taking another snapshot o accepts file: Blob; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("uncertain storage writes retry persisted keys without taking another snapshot o preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("uncertain storage writes retry persisted keys without taking another snapshot or making a second copy", async () => {
  const fixtureData = await fixture();
  mocks.upload.mockImplementationOnce(
    (key: string, _name: string, file: Blob) => {
      mocks.files.set(key, file);
      return Promise.reject(new Error("Lost storage reply"));
    }
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading conversation from operation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(bound.id).toBe(operation?.conversation.id);
  expect(mocks.source).toHaveBeenCalledTimes(1);
  expect(mocks.upload.mock.calls[0][0]).toBe(mocks.upload.mock.calls[1][0]);
  expect(mocks.native.size).toBe(1);
  await expect(
    saveEveCopyOperation(
      ownerId,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing fixtureData.input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      { ...fixtureData.input, sourceConversationId: crypto.randomUUID() },
      "https://chatjs.example"
    )
  ).rejects.toThrow("different source or model");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("an unavailable native lookup leaves acceptance recoverable and never blindly di uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading copy from copyOperationAfterLookupFailure; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(copyOperationAfterLookupFailure?.copy.phase).toBe("accepted");
  expect(mocks.request).toHaveBeenCalledTimes(1);
  expect(mocks.native.size).toBe(0);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): test("concurrent requests converge on the persisted allocation and one native copy") uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("concurrent requests converge on the persisted allocation and one native copy") accepts attempt; call; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("concurrent requests converge on the persisted allocation and one native copy") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("concurrent requests converge on the persisted allocation and one native copy", async () => {
  const fixtureData = await fixture();
  const attempts = await Promise.allSettled(
    Array.from({ length: 3 }, () =>
      saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
    )
  );
  expect(attempts.some((attempt) => attempt.status === "fulfilled")).toBe(true);
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
      (call) => call[1] === "/eve/chat/v1/session"
    )
  ).toHaveLength(1);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null --
 * max-statements (#512): test("revocation before acceptance purges only the rejected destination and keeps a r keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("revocation before acceptance purges only the rejected destination and keeps a r uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("revocation before acceptance purges only the rejected destination and keeps a r accepts file: Blob; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("revocation before acceptance purges only the rejected destination and keeps a r preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): test("revocation before acceptance purges only the rejected destination and keeps a r preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("revocation before acceptance purges only the rejected destination and keeps a replay tombstone", async () => {
  const fixtureData = await fixture();
  mocks.upload.mockImplementationOnce(
    (key: string, _name: string, file: Blob) => {
      mocks.files.set(key, file);
      return Promise.reject(new Error("Interrupted preparation"));
    }
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure accepts file: Blob; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("a lost cleanup reply leaves rejection discoverable and a retry finishes erasure", async () => {
  const fixtureData = await fixture();
  mocks.upload.mockImplementationOnce(
    (key: string, _name: string, file: Blob) => {
      mocks.files.set(key, file);
      return Promise.reject(new Error("Interrupted preparation"));
    }
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading copy from copyOperationAfterLostCleanupReply; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-undefined --
 * no-undefined (#519): test("a definitive model rejection tombstones the operation but transient catalog fai uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
  mocks.model.mockResolvedValue(undefined);
  await expect(
    saveEveCopyOperation(ownerId, fixtureData.input, "https://chatjs.example")
  ).rejects.toThrow();
  expect(mocks.source).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-undefined */

/* oxlint-disable max-lines -- #509: This eve-save-copy.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
