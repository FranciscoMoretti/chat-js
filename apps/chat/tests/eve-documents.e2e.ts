/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:assert/strict" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import assert from "node:assert/strict";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-deletion"; "../lib/db/eve-documents"; "../lib/db/eve-file-purge"; "../lib/db/eve-files" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable unicorn/consistent-function-scoping -- One-off helpers stay beside the scenario state they coordinate. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import assert from "node:assert/strict";

import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { db } from "../lib/db/client";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  captureEveDocumentCheckpoint,
  captureEveNamedDocumentCheckpoint,
  getAccessibleEveDocument,
  getEveDocumentHistory,
  getEveDocumentRevision,
  initializeEveForkDocuments,
  purgeEveFamilyDocuments,
  removeEveDocumentFromConversation,
  saveEveDocumentRevision,
} from "../lib/db/eve-documents";
import { prepareEveFamilyFilePurge } from "../lib/db/eve-file-purge";
import { referenceEveFiles, registerEveStoredFile } from "../lib/db/eve-files";
import {
  beginEveConversationDeletion,
  createEveConversation,
} from "../lib/db/eve-queries";
import {
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
import { env } from "../lib/env";
import { documentHistoryTurns } from "../lib/eve/document-history";
import { executeEveDocumentTool } from "../lib/eve/document-tools";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

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
/* oxlint-disable max-statements --
 * max-statements (#512): afterAll keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
afterAll(async () => {
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
/* oxlint-enable max-statements */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep conversation's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
async function conversation() {
  return await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Artifact fixture",
    async () => crypto.randomUUID()
  );
}
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep draft's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): draft preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
function draft(conversationId: string) {
  return {
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
  };
}
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): test("document purge requires the owned family fence, erases inherited revisions, and keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("document purge requires the owned family fence, erases inherited revisions, and keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("document purge requires the owned family fence, erases inherited revisions, and uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("document purge requires the owned family fence, erases inherited revisions, and is retryable", async () => {
  const root = await conversation();
  const input = draft(root.id);
  const original = await saveEveDocumentRevision(input);
  await captureEveDocumentCheckpoint(owner, root.id, 1);
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Purge fork",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", conversationId: root.id } }
  );
  await saveEveDocumentRevision({
    ...input,
    content: "Child revision",
    conversationId: child.id,
    expectedRevisionId: original.id,
    operationId: crypto.randomUUID(),
  });
  await captureEveDocumentCheckpoint(owner, child.id, 2);
  const unrelated = await conversation();
  const surviving = await saveEveDocumentRevision(draft(unrelated.id));

  await expect(purgeEveFamilyDocuments(owner, root.id)).rejects.toThrow(
    "entire conversation family"
  );
  const deletion = await beginEveConversationDeletion(owner, child.id);
  assert.ok(deletion);
  await expect(purgeEveFamilyDocuments(stranger, root.id)).rejects.toThrow();
  await expect(purgeEveFamilyDocuments(owner, child.id)).rejects.toThrow();
  await expect(
    completeEveConversationDeletion(owner, deletion.rootId)
  ).rejects.toThrow("content cleanup is incomplete");
  await purgeEveFamilyDocuments(owner, deletion.rootId);
  await purgeEveFamilyDocuments(owner, deletion.rootId);
  for (const table of [
    eveDocumentCheckpointEntry,
    eveDocumentCheckpoint,
    eveDocumentHead,
    eveDocumentRevision,
  ]) {
    expect(
      await db
        .select({ conversationId: table.conversationId })
        .from(table)
        .where(inArray(table.conversationId, [root.id, child.id]))
    ).toEqual([]);
  }
  expect(
    await getEveDocumentRevision(owner, unrelated.id, surviving.documentId)
  ).toEqual(surviving);
  expect(
    (
      await db
        .select({ state: eveConversation.state })
        .from(eveConversation)
        .where(inArray(eveConversation.id, [root.id, child.id]))
    ).map((row) => row.state)
  ).toEqual(["deleting", "deleting"]);
  await expect(
    saveEveDocumentRevision({
      ...input,
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow();
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("an external document reference rolls back every purge step") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("an external document reference rolls back every purge step") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("an external document reference rolls back every purge step", async () => {
  const root = await conversation();
  const input = draft(root.id);
  const revision = await saveEveDocumentRevision(input);
  await captureEveDocumentCheckpoint(owner, root.id, 1);
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
  for (const table of [
    eveDocumentCheckpointEntry,
    eveDocumentCheckpoint,
    eveDocumentHead,
    eveDocumentRevision,
  ]) {
    expect(
      await db
        .select({ conversationId: table.conversationId })
        .from(table)
        .where(eq(table.conversationId, root.id))
    ).toHaveLength(1);
  }
  expect(
    await db
      .select()
      .from(eveDocumentHead)
      .where(eq(eveDocumentHead.conversationId, external.id))
  ).toHaveLength(1);
});
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-lines-per-function, no-magic-numbers, no-undefined, unicorn/no-null --
 * max-lines-per-function (#510): test("manual edits backfill inherited boundaries in old forks before adding manual an keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("manual edits backfill inherited boundaries in old forks before adding manual an uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("manual edits backfill inherited boundaries in old forks before adding manual an uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * unicorn/no-null (#570): test("manual edits backfill inherited boundaries in old forks before adding manual an preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("manual edits backfill inherited boundaries in old forks before adding manual ancestry", async () => {
  const source = await conversation();
  const input = draft(source.id);
  const original = await saveEveDocumentRevision(input);
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Old fork",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_2", conversationId: source.id } }
  );
  const turns = documentHistoryTurns([
    {
      data: {
        beforeTurnId: "turn_2",
        events: [0, 1].map((turn) => ({
          type: "step.started" as const,
          meta: { id: `step-${turn}`, at: new Date().toISOString() },
          data: {
            modelId: "gateway/test",
            sequence: turn,
            stepIndex: 0,
            turnId: `turn_${turn}`,
          },
        })),
        sourceSessionId: source.sessionId ?? "source",
      },
      meta: { at: new Date().toISOString(), id: "restored" },
      type: "history.restored",
    },
  ]);
  await saveEveDocumentRevision(
    {
      ...input,
      content: "Manual on old fork",
      conversationId: child.id,
      expectedRevisionId: original.id,
      operationId: crypto.randomUUID(),
      turnIndex: null,
    },
    undefined,
    turns
  );
  const earlier = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Inherited boundary",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", conversationId: child.id } }
  );
  expect(
    (await getEveDocumentRevision(owner, earlier.id, input.documentId))?.id
  ).toBe(original.id);
});
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, unicorn/no-null --
 * max-lines-per-function (#510): test("manual edits backfill old native boundaries and stay isolated across nested for keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("manual edits backfill old native boundaries and stay isolated across nested for keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("manual edits backfill old native boundaries and stay isolated across nested for uses 0, 1, 2, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("manual edits backfill old native boundaries and stay isolated across nested for uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * unicorn/no-null (#570): test("manual edits backfill old native boundaries and stay isolated across nested for preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("manual edits backfill old native boundaries and stay isolated across nested forks", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const original = await saveEveDocumentRevision(input);
  const manualInput = {
    ...input,
    content: "Manual content",
    expectedRevisionId: original.id,
    operationId: crypto.randomUUID(),
    turnIndex: null,
  };
  const manual = await saveEveDocumentRevision(manualInput, undefined, [0, 1]);
  expect(manual.turnIndex).toBeNull();
  await captureEveDocumentCheckpoint(owner, chat.id, 2);
  const generated = await saveEveDocumentRevision({
    ...input,
    content: "Generated later",
    expectedRevisionId: manual.id,
    operationId: crypto.randomUUID(),
    turnIndex: 2,
  });
  expect(
    (await saveEveDocumentRevision(manualInput, undefined, [0, 1, 2])).id
  ).toBe(manual.id);
  expect(
    (await getEveDocumentRevision(owner, chat.id, input.documentId))?.id
  ).toBe(generated.id);
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Manual branch",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_2", conversationId: chat.id } }
  );
  expect(
    (await getEveDocumentRevision(owner, child.id, input.documentId))?.content
  ).toBe("Manual content");
  const earlier = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Before manual",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", conversationId: child.id } }
  );
  expect(
    (await getEveDocumentRevision(owner, earlier.id, input.documentId))?.id
  ).toBe(original.id);
  await expect(
    saveEveDocumentRevision(
      {
        ...manualInput,
        expectedRevisionId: generated.id,
        operationId: crypto.randomUUID(),
      },
      undefined,
      [0, 1, 2, 3]
    )
  ).rejects.toThrow("checkpoint is not ready");
  expect(
    (await getEveDocumentRevision(owner, chat.id, input.documentId))?.id
  ).toBe(generated.id);
  await expect(
    saveEveDocumentRevision({
      ...manualInput,
      expectedRevisionId: generated.id,
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow("native history");
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async --
 * max-lines-per-function (#510): test("turn checkpoints restore exact heads, including empty state, and never change o keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("turn checkpoints restore exact heads, including empty state, and never change o keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("turn checkpoints restore exact heads, including empty state, and never change o uses 0, 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("turn checkpoints restore exact heads, including empty state, and never change o preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("turn checkpoints restore exact heads, including empty state, and never change on replay", async () => {
  const chat = await conversation();
  await captureEveDocumentCheckpoint(owner, chat.id, 0);
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  await Promise.all(
    Array.from({ length: 5 }, () =>
      captureEveDocumentCheckpoint(owner, chat.id, 1)
    )
  );
  await saveEveDocumentRevision({
    ...input,
    content: "Later content",
    expectedRevisionId: first.id,
    operationId: crypto.randomUUID(),
    turnIndex: 0,
  });
  await captureEveDocumentCheckpoint(owner, chat.id, 1);
  await captureEveDocumentCheckpoint(owner, chat.id, 2);
  const laterBranch = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Later branch",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_2", conversationId: chat.id } }
  );
  // Replaying fork initialization must leave inherited boundaries unchanged.
  await initializeEveForkDocuments(owner, laterBranch.id);
  const earlierBranch = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Earlier nested branch",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", conversationId: laterBranch.id } }
  );
  expect(
    (await getEveDocumentRevision(owner, laterBranch.id, input.documentId))
      ?.content
  ).toBe("Later content");
  expect(
    (await getEveDocumentRevision(owner, earlierBranch.id, input.documentId))
      ?.id
  ).toBe(first.id);
  for (const beforeTurnId of ["turn_0", "turn_1"]) {
    const child = await createEveConversation(
      owner,
      crypto.randomUUID(),
      "Checkpoint fork",
      async () => crypto.randomUUID(),
      { fork: { beforeTurnId, conversationId: chat.id } }
    );
    const document = await getEveDocumentRevision(
      owner,
      child.id,
      input.documentId
    );
    if (beforeTurnId === "turn_0") {
      expect(document).toBeUndefined();
    } else {
      expect(document?.id).toBe(first.id);
      expect(document?.content).toBe("Original");
    }
  }
  await expect(
    captureEveDocumentCheckpoint(stranger, chat.id, 2)
  ).rejects.toThrow("not found");
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("a document save cancelled while waiting for its lock never writes") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a document save cancelled while waiting for its lock never writes") uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("a document save cancelled while waiting for its lock never writes") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): test("a document save cancelled while waiting for its lock never writes") accepts tx; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("a document save cancelled while waiting for its lock never writes", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const controller = new AbortController();
  const held = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  const lockKey = `eve-document:${chat.id}`;
  const locker = db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
    );
    held.resolve(undefined);
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
    release.resolve(undefined);
    await locker;
    await saving;
  }
  expect((await saving)[0].status).toBe("rejected");
  expect(await getEveDocumentHistory(owner, chat.id, input.documentId)).toEqual(
    []
  );
});
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined --
 * max-lines-per-function (#510): test("document viewing respects visibility, revocation and fork ancestry without expo keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("document viewing respects visibility, revocation and fork ancestry without expo keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("document viewing respects visibility, revocation and fork ancestry without expo uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("document viewing respects visibility, revocation and fork ancestry without expo uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", conversationId: chat.id } }
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
    revision: { content: "Original", id: first.id },
  });
  expect(visible?.revision).not.toHaveProperty("ownerId");
  expect(visible?.revision).not.toHaveProperty("operationId");
  expect(visible?.history).toHaveLength(1);
  expect(
    await getAccessibleEveDocument(
      undefined,
      child.id,
      input.documentId,
      later.id
    )
  ).toBeUndefined();
  await db
    .update(eveConversation)
    .set({ visibility: "private" })
    .where(eq(eveConversation.id, child.id));
  expect(
    await getAccessibleEveDocument(undefined, child.id, input.documentId)
  ).toBeUndefined();
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): test("native document calls replay safely and reject stale edits and cross-conversati keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native document calls replay safely and reject stale edits and cross-conversati keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native document calls replay safely and reject stale edits and cross-conversati uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): test("concurrent replays create one revision and old replays never rewind the head") uses 1, 0, -1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("concurrent replays create one revision and old replays never rewind the head") accepts revision; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("concurrent replays create one revision and old replays never rewind the head") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("concurrent replays create one revision and old replays never rewind the head", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const revisions = await Promise.all(
    Array.from({ length: 8 }, () => saveEveDocumentRevision(input))
  );
  expect(new Set(revisions.map((revision) => revision.id)).size).toBe(1);
  const second = await saveEveDocumentRevision({
    ...input,
    content: "Updated",
    expectedRevisionId: revisions[0].id,
    operationId: crypto.randomUUID(),
    turnIndex: 1,
  });
  expect((await saveEveDocumentRevision(input)).id).toBe(revisions[0].id);
  expect(
    (await getEveDocumentHistory(owner, chat.id, input.documentId)).at(-1)?.id
  ).toBe(second.id);
  await expect(
    saveEveDocumentRevision({ ...input, content: "Changed replay" })
  ).rejects.toThrow("replay");
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): test("two distinct saves from the same revision cannot overwrite each other") uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("two distinct saves from the same revision cannot overwrite each other") accepts result; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("two distinct saves from the same revision cannot overwrite each other") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("two distinct saves from the same revision cannot overwrite each other", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  const outcomes = await Promise.allSettled(
    ["A", "B"].map((content) =>
      saveEveDocumentRevision({
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

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

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * max-lines-per-function (#510): test("forks select the pre-turn revision and parent and child edits stay independent" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("forks select the pre-turn revision and parent and child edits stay independent" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("forks select the pre-turn revision and parent and child edits stay independent" uses -1, 4 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("forks select the pre-turn revision and parent and child edits stay independent" accepts revision; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): test("forks select the pre-turn revision and parent and child edits stay independent" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("forks select the pre-turn revision and parent and child edits stay independent", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const first = await saveEveDocumentRevision(input);
  const parentLater = await saveEveDocumentRevision({
    ...input,
    content: "Parent after fork point",
    expectedRevisionId: first.id,
    operationId: crypto.randomUUID(),
    turnIndex: 1,
  });
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Fork",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", conversationId: chat.id } }
  );
  expect(
    (await getEveDocumentHistory(owner, child.id, input.documentId)).map(
      (revision) => revision.id
    )
  ).toEqual([first.id]);
  const childEdit = await saveEveDocumentRevision({
    ...input,
    content: "Child",
    conversationId: child.id,
    expectedRevisionId: first.id,
    operationId: crypto.randomUUID(),
    turnIndex: 1,
  });
  await saveEveDocumentRevision({
    ...input,
    content: "Parent newest",
    expectedRevisionId: parentLater.id,
    operationId: crypto.randomUUID(),
    turnIndex: 2,
  });
  await initializeEveForkDocuments(owner, child.id);
  expect(
    (await getEveDocumentHistory(owner, child.id, input.documentId)).at(-1)?.id
  ).toBe(childEdit.id);
  expect(
    (await getEveDocumentRevision(owner, chat.id, input.documentId))?.content
  ).toBe("Parent newest");
  const nested = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Nested",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", conversationId: child.id } }
  );
  expect(
    (await getEveDocumentHistory(owner, nested.id, input.documentId)).map(
      (revision) => revision.id
    )
  ).toEqual([first.id]);
  expect(
    await db
      .select()
      .from(eveDocumentRevision)
      .where(
        and(
          eq(eveDocumentRevision.ownerId, owner),
          eq(eveDocumentRevision.documentId, input.documentId)
        )
      )
  ).toHaveLength(4);
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("history beyond 1000 revisions remains readable and forkable without loading all keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("history beyond 1000 revisions remains readable and forkable without loading all keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("history beyond 1000 revisions remains readable and forkable without loading all uses 0, 1, -1, 1002, 498 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("history beyond 1000 revisions remains readable and forkable without loading all accepts version; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): test("history beyond 1000 revisions remains readable and forkable without loading all intentionally keeps the existing falsy-value behavior of tail; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
  if (!tail) {
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
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_500", conversationId: chat.id } }
  );
  expect(
    (await getEveDocumentHistory(owner, child.id, input.documentId)).at(-1)?.id
  ).toBe(ids[498]);
  expect(
    await getEveDocumentRevision(owner, child.id, input.documentId, newest.id)
  ).toBeUndefined();
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("document references protect owned files across families and revision history") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("document references protect owned files across families and revision history") uses 0, 24 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  expect(
    (
      await getEveDocumentRevision(
        owner,
        destination.id,
        input.documentId,
        revision.id
      )
    )?.content
  ).toBe(input.content);
});
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, unicorn/no-null --
 * max-lines-per-function (#510): test("named idle snapshots preserve manual edits across retries without changing turn keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("named idle snapshots preserve manual edits across retries without changing turn keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("named idle snapshots preserve manual edits across retries without changing turn uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("named idle snapshots preserve manual edits across retries without changing turn uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * unicorn/no-null (#570): test("named idle snapshots preserve manual edits across retries without changing turn preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("named idle snapshots preserve manual edits across retries without changing turn checkpoints", async () => {
  const chat = await conversation();
  const input = draft(chat.id);
  const original = await saveEveDocumentRevision(input);
  await captureEveDocumentCheckpoint(owner, chat.id, 1);
  const manual = await saveEveDocumentRevision(
    {
      ...input,
      content: "Idle edit",
      expectedRevisionId: original.id,
      operationId: crypto.randomUUID(),
      turnIndex: null,
    },
    undefined,
    [0, 1]
  );
  const checkpointId = crypto.randomUUID();
  await Promise.all([
    captureEveNamedDocumentCheckpoint(owner, chat.id, checkpointId, 1),
    captureEveNamedDocumentCheckpoint(owner, chat.id, checkpointId, 1),
  ]);
  await saveEveDocumentRevision(
    {
      ...input,
      content: "Later edit",
      expectedRevisionId: manual.id,
      operationId: crypto.randomUUID(),
      turnIndex: null,
    },
    undefined,
    [0, 1]
  );
  await captureEveNamedDocumentCheckpoint(owner, chat.id, checkpointId, 1);
  const operationId = crypto.randomUUID();
  const fork = {
    beforeTurnId: "turn_1",
    checkpointId,
    conversationId: chat.id,
  };
  const child = await createEveConversation(
    owner,
    operationId,
    "Named fork",
    async () => crypto.randomUUID(),
    { fork }
  );
  expect(
    (await getEveDocumentRevision(owner, child.id, input.documentId))?.id
  ).toBe(manual.id);
  const ordinary = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Turn fork",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", conversationId: chat.id } }
  );
  expect(
    (await getEveDocumentRevision(owner, ordinary.id, input.documentId))?.id
  ).toBe(original.id);
  await captureEveDocumentCheckpoint(owner, child.id, 1);
  const grandchild = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Nested fork",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", conversationId: child.id } }
  );
  expect(
    (await getEveDocumentRevision(owner, grandchild.id, input.documentId))?.id
  ).toBe(manual.id);
  await expect(
    createEveConversation(
      owner,
      operationId,
      "Named fork",
      async () => crypto.randomUUID(),
      { fork: { ...fork, checkpointId: crypto.randomUUID() } }
    )
  ).rejects.toThrow("different");
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, unicorn/no-null */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("named checkpoints reject foreign owners, changed boundaries and deletion, and p keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("named checkpoints reject foreign owners, changed boundaries and deletion, and p uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("named checkpoints reject foreign owners, changed boundaries and deletion, and preserve empty manifests", async () => {
  const chat = await conversation();
  const checkpointId = crypto.randomUUID();
  await expect(
    captureEveNamedDocumentCheckpoint(stranger, chat.id, checkpointId, 1)
  ).rejects.toThrow("not found");
  await captureEveNamedDocumentCheckpoint(owner, chat.id, checkpointId, 1);
  await expect(
    captureEveNamedDocumentCheckpoint(owner, chat.id, checkpointId, 2)
  ).rejects.toThrow("different source turn");
  const input = draft(chat.id);
  await saveEveDocumentRevision(input);
  await captureEveNamedDocumentCheckpoint(owner, chat.id, checkpointId, 1);
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Empty fork",
    async () => crypto.randomUUID(),
    { fork: { beforeTurnId: "turn_1", checkpointId, conversationId: chat.id } }
  );
  expect(
    await getEveDocumentRevision(owner, child.id, input.documentId)
  ).toBeUndefined();
  // Include a nonempty manifest to verify FK-safe family cleanup too.
  await captureEveNamedDocumentCheckpoint(
    owner,
    chat.id,
    crypto.randomUUID(),
    1
  );
  const deletion = await beginEveConversationDeletion(owner, chat.id);
  assert.ok(deletion);
  await expect(
    captureEveNamedDocumentCheckpoint(owner, chat.id, crypto.randomUUID(), 1)
  ).rejects.toThrow("not found");
  await purgeEveFamilyDocuments(owner, deletion.rootId);
  await purgeEveFamilyDocuments(owner, deletion.rootId);
  for (const table of [
    eveNamedDocumentCheckpointEntry,
    eveNamedDocumentCheckpoint,
  ]) {
    expect(
      await db.select().from(table).where(eq(table.conversationId, chat.id))
    ).toEqual([]);
  }
});
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/promise-function-async --
 * no-magic-numbers (#517): test("missing or mismatched named document boundaries stop native allocation") uses 1, 2, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("missing or mismatched named document boundaries stop native allocation") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("missing or mismatched named document boundaries stop native allocation", async () => {
  const chat = await conversation();
  const checkpointId = crypto.randomUUID();
  let allocations = 0;
  const allocate = (): Promise<string> => {
    allocations += 1;
    return Promise.resolve(crypto.randomUUID());
  };
  const missing = {
    beforeTurnId: "turn_1",
    checkpointId,
    conversationId: chat.id,
  };
  await expect(
    createEveConversation(
      owner,
      crypto.randomUUID(),
      "Missing checkpoint",
      allocate,
      { fork: missing }
    )
  ).rejects.toThrow("Named document checkpoint");
  await captureEveNamedDocumentCheckpoint(owner, chat.id, checkpointId, 2);
  await expect(
    createEveConversation(
      owner,
      crypto.randomUUID(),
      "Wrong boundary",
      allocate,
      { fork: missing }
    )
  ).rejects.toThrow("Named document checkpoint");
  expect(allocations).toBe(0);
});
/* oxlint-enable no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions --
 * max-statements (#512): test.each([false, true])("native descendants retain imported document boundaries, inc keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test.each([false, true])("native descendants retain imported document boundaries, inc uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test.each([false, true])("native descendants retain imported document boundaries, inc uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-boolean-expressions (#610): test.each([false, true])("native descendants retain imported document boundaries, inc intentionally keeps the existing falsy-value behavior of checkpointId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test.each([false, true])(
  "native descendants retain imported document boundaries, including empty ones (named=%s)",
  async (named) => {
    const root = await conversation();
    const input = draft(root.id);
    const original = await saveEveDocumentRevision(input);
    await db.insert(eveImportedDocumentCheckpoint).values([
      { conversationId: root.id, messageIndex: 0, ownerId: owner },
      { conversationId: root.id, messageIndex: 2, ownerId: owner },
    ]);
    await db.insert(eveImportedDocumentCheckpointEntry).values({
      conversationId: root.id,
      documentId: input.documentId,
      messageIndex: 2,
      ownerId: owner,
      revisionId: original.id,
    });
    await captureEveDocumentCheckpoint(owner, root.id, 1);
    const checkpointId = named ? crypto.randomUUID() : undefined;
    if (checkpointId) {
      await captureEveNamedDocumentCheckpoint(owner, root.id, checkpointId, 1);
    }
    const child = await createEveConversation(
      owner,
      crypto.randomUUID(),
      "Imported prefix descendant",
      async () => crypto.randomUUID(),
      {
        fork: { beforeTurnId: "turn_1", checkpointId, conversationId: root.id },
      }
    );
    await initializeEveForkDocuments(owner, child.id);
    const headers = await db
      .select({ messageIndex: eveImportedDocumentCheckpoint.messageIndex })
      .from(eveImportedDocumentCheckpoint)
      .where(eq(eveImportedDocumentCheckpoint.conversationId, child.id))
      .orderBy(eveImportedDocumentCheckpoint.messageIndex);
    expect(headers).toEqual([{ messageIndex: 0 }, { messageIndex: 2 }]);
    const entries = await db
      .select()
      .from(eveImportedDocumentCheckpointEntry)
      .where(eq(eveImportedDocumentCheckpointEntry.conversationId, child.id));
    expect(entries).toEqual([
      {
        conversationId: child.id,
        documentId: input.documentId,
        messageIndex: 2,
        ownerId: owner,
        revisionId: original.id,
      },
    ]);
  }
);
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): test("imported forks restore the selected document boundary and exclude the later pre keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("imported forks restore the selected document boundary and exclude the later pre keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("imported forks restore the selected document boundary and exclude the later pre uses 0, 2, 4, 6 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("imported forks restore the selected document boundary and exclude the later prefix", async () => {
  const root = await conversation();
  const input = draft(root.id);
  const original = await saveEveDocumentRevision(input);
  const later = await saveEveDocumentRevision({
    ...input,
    content: "Later edit",
    expectedRevisionId: original.id,
    operationId: crypto.randomUUID(),
    turnIndex: 1,
  });
  await db.insert(eveImportedDocumentCheckpoint).values(
    [0, 2, 4].map((messageIndex) => ({
      conversationId: root.id,
      messageIndex,
      ownerId: owner,
    }))
  );
  await db.insert(eveImportedDocumentCheckpointEntry).values([
    {
      conversationId: root.id,
      documentId: input.documentId,
      messageIndex: 2,
      ownerId: owner,
      revisionId: original.id,
    },
    {
      conversationId: root.id,
      documentId: input.documentId,
      messageIndex: 4,
      ownerId: owner,
      revisionId: later.id,
    },
  ]);
  for (const index of [0, 2, 6]) {
    const [child] = await insertEveConversationFixtures({
      firstMessage: "Imported edit",
      forkMessageId: `seed_message_${index}`,
      operationId: crypto.randomUUID(),
      ownerId: owner,
      parentConversationId: root.id,
      rootConversationId: root.id,
    });
    await expect(
      initializeEveForkDocuments(stranger, child.id)
    ).rejects.toThrow("Fork conversation not found");
    if (index === 6) {
      await expect(initializeEveForkDocuments(owner, child.id)).rejects.toThrow(
        "Imported document boundary is unavailable"
      );
    } else {
      await initializeEveForkDocuments(owner, child.id);
      await initializeEveForkDocuments(owner, child.id);
    }
    const heads = await db
      .select({ revisionId: eveDocumentHead.revisionId })
      .from(eveDocumentHead)
      .where(eq(eveDocumentHead.conversationId, child.id));
    expect(heads).toEqual(index === 2 ? [{ revisionId: original.id }] : []);
    const headers = await db
      .select({ messageIndex: eveImportedDocumentCheckpoint.messageIndex })
      .from(eveImportedDocumentCheckpoint)
      .where(eq(eveImportedDocumentCheckpoint.conversationId, child.id));
    expect(headers).toEqual(index === 2 ? [{ messageIndex: 0 }] : []);
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/no-null --
 * max-lines-per-function (#510): test("imported fork reservations retain their boundary across uncertain creation and  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("imported fork reservations retain their boundary across uncertain creation and  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("imported fork reservations retain their boundary across uncertain creation and  uses 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep test("imported fork reservations retain their boundary across uncertain creation and 's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): test("imported fork reservations retain their boundary across uncertain creation and  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): test("imported fork reservations retain their boundary across uncertain creation and  preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("imported fork reservations retain their boundary across uncertain creation and reject changed retries", async () => {
  const root = await conversation();
  await db.insert(eveImportedDocumentCheckpoint).values(
    [0, 2].map((messageIndex) => ({
      conversationId: root.id,
      messageIndex,
      ownerId: owner,
    }))
  );
  const operationId = crypto.randomUUID();
  const fork = { beforeMessageId: "seed_message_2", conversationId: root.id };
  const failedDispatch = () => Promise.reject(new Error("Lost native reply"));
  await expect(
    createEveConversation(owner, operationId, "Replacement", failedDispatch, {
      fork,
    })
  ).rejects.toThrow();
  const [reserved] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.operationId, operationId));
  expect(reserved).toMatchObject({
    forkMessageId: "seed_message_2",
    forkTurnId: null,
    state: "uncertain",
  });
  const sessionId = crypto.randomUUID();
  for (const changed of [
    { beforeMessageId: "seed_message_0", conversationId: root.id },
    { beforeTurnId: "turn_0", conversationId: root.id },
  ]) {
    await expect(
      createEveConversation(
        owner,
        operationId,
        "Replacement",
        async () => sessionId,
        { fork: changed }
      )
    ).rejects.toThrow("different");
  }
  const bound = await createEveConversation(
    owner,
    operationId,
    "Replacement",
    async () => sessionId,
    { fork }
  );
  expect(bound).toEqual({ id: reserved.id, sessionId });
  expect(
    await createEveConversation(
      owner,
      operationId,
      "Replacement",
      failedDispatch,
      { fork }
    )
  ).toEqual(bound);
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): test("approved deletion is scoped, revision-checked, retryable, and preserves fork sn keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("approved deletion is scoped, revision-checked, retryable, and preserves fork sn keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("approved deletion is scoped, revision-checked, retryable, and preserves fork sn uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("approved deletion is scoped, revision-checked, retryable, and preserves fork snapshots", async () => {
  const root = await conversation();
  const input = draft(root.id);
  const original = await saveEveDocumentRevision(input);
  await captureEveDocumentCheckpoint(owner, root.id, 1);
  const child = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Retained fork",
    async () => crypto.randomUUID(),
    {
      fork: { beforeTurnId: "turn_1", conversationId: root.id },
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
  ).toBeUndefined();
  expect(
    (await getEveDocumentRevision(owner, child.id, input.documentId))?.id
  ).toBe(original.id);
  await captureEveDocumentCheckpoint(owner, root.id, 2);
  const later = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "After deletion",
    async () => crypto.randomUUID(),
    {
      fork: { beforeTurnId: "turn_2", conversationId: root.id },
    }
  );
  expect(
    await getEveDocumentRevision(owner, later.id, input.documentId)
  ).toBeUndefined();
  const replacement = await saveEveDocumentRevision({
    ...input,
    operationId: crypto.randomUUID(),
    content: "Replacement",
    turnIndex: 2,
  });
  await expect(
    removeEveDocumentFromConversation(currentDeletion, scope, signal)
  ).rejects.toThrow("Document changed");
  expect(
    (await getEveDocumentRevision(owner, root.id, input.documentId))?.id
  ).toBe(replacement.id);
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable max-lines -- #509: This eve-documents.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
