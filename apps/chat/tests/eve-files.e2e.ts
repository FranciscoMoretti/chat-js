import { eq, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import { db } from "../lib/db/client";
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
import {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
  releaseEveFamilyFileReferences,
} from "../lib/db/eve-file-purge";
import {
  isEveFileUnavailable,
  referenceEveFiles,
  registerEveStoredFile,
  reserveEveGeneratedFile,
  reserveEveUpload,
  writeEveGeneratedFile,
  writeEveUpload,
} from "../lib/db/eve-files";
import { prepareEveOrphanedFilePurge } from "../lib/db/eve-orphaned-files";
import {
  beginEveConversationDeletion,
  createEveConversation,
} from "../lib/db/eve-queries";
import {
  eveConversation,
  eveFileReference,
  eveStoredFile,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("File ownership acceptance requires local Postgres.");
}
const owner = crypto.randomUUID();
const stranger = crypto.randomUUID();
await db.insert(user).values(
  [owner, stranger].map((id) => ({
    id,
    email: `${id}@test.invalid`,
    name: "File ownership fixture",
  }))
);
afterAll(async () => {
  await db
    .delete(eveFileReference)
    .where(inArray(eveFileReference.ownerId, [owner, stranger]));
  await db
    .delete(eveConversation)
    .where(inArray(eveConversation.ownerId, [owner, stranger]));
  await db
    .delete(eveStoredFile)
    .where(inArray(eveStoredFile.ownerId, [owner, stranger]));
  await db.delete(user).where(inArray(user.id, [owner, stranger]));
});

test("server-created file ownership is retryable but cannot be reassigned", async () => {
  const key = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.png`;
  await registerEveStoredFile(owner, key);
  await registerEveStoredFile(owner, key);
  await expect(registerEveStoredFile(stranger, key)).rejects.toThrow(
    "cannot be reassigned"
  );
  expect(
    await db
      .select({ ownerId: eveStoredFile.ownerId })
      .from(eveStoredFile)
      .where(eq(eveStoredFile.key, key))
  ).toEqual([{ ownerId: owner }]);
});

test("registration rejects URLs and invalid storage keys", async () => {
  for (const key of [
    "../file",
    "https://example.com/file.png",
    "",
    "a".repeat(25),
  ]) {
    await expect(registerEveStoredFile(owner, key)).rejects.toThrow(
      "Invalid file ownership"
    );
  }
});

test("references reject foreign files and become immutable behind the deletion fence", async () => {
  const id = crypto.randomUUID();
  await db.insert(eveConversation).values({
    id,
    ownerId: owner,
    operationId: crypto.randomUUID(),
    firstMessage: "fixture",
    state: "bound",
  });
  const key = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  const foreignKey = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  await registerEveStoredFile(owner, key);
  await registerEveStoredFile(stranger, foreignKey);
  await expect(referenceEveFiles(owner, id, [key, foreignKey])).rejects.toThrow(
    "not owned"
  );
  expect(
    await db
      .select()
      .from(eveFileReference)
      .where(eq(eveFileReference.conversationId, id))
  ).toEqual([]);
  await referenceEveFiles(owner, id, [key, key]);
  await referenceEveFiles(owner, id, [key]);
  expect(
    await db
      .select()
      .from(eveFileReference)
      .where(eq(eveFileReference.conversationId, id))
  ).toHaveLength(1);
  await db
    .update(eveConversation)
    .set({ state: "deleting" })
    .where(eq(eveConversation.id, id));
  await expect(referenceEveFiles(owner, id, [key])).rejects.toThrow(
    "unavailable"
  );
});

test("fork reservation retains the source file references before dispatch", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "source",
    async () => crypto.randomUUID()
  );
  const key = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  await registerEveStoredFile(owner, key);
  await referenceEveFiles(owner, root.id, [key]);
  let dispatched = false;
  const fork = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "fork",
    async (id) => {
      expect(
        await db
          .select({ key: eveFileReference.key })
          .from(eveFileReference)
          .where(eq(eveFileReference.conversationId, id))
      ).toEqual([{ key }]);
      dispatched = true;
      return crypto.randomUUID();
    },
    { fork: { conversationId: root.id, beforeTurnId: "turn_0" } }
  );
  expect(dispatched).toBe(true);
  expect(
    await db
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(eq(eveFileReference.conversationId, fork.id))
  ).toEqual([{ key }]);
});

test("attachment creation commits references before dispatch with a single application connection", async () => {
  const key = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  await registerEveStoredFile(owner, key);
  // The worker uses its own connection; the application's pool may have only one.
  const worker = postgres(env.DATABASE_URL, { max: 1 });
  try {
    const binding = await createEveConversation(
      owner,
      crypto.randomUUID(),
      "attached",
      async (id) => {
        const references =
          await worker`select key from "EveFileReference" where "conversationId" = ${id}`;
        expect(references.map((row) => row.key)).toEqual([key]);
        return crypto.randomUUID();
      },
      { initialContentHash: "attachment-fixture", fileKeys: [key] }
    );
    expect(binding.sessionId).toBeTruthy();
  } finally {
    await worker.end();
  }
});

test("generated file reservations survive storage failure and cannot write after deletion begins", async () => {
  const conversation = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "generated",
    async () => crypto.randomUUID()
  );
  const key = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  await reserveEveGeneratedFile(owner, conversation.id, key);
  await expect(
    writeEveGeneratedFile(owner, conversation.id, key, () =>
      Promise.reject(new Error("storage failed"))
    )
  ).rejects.toThrow("storage failed");
  expect(
    await db
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(eq(eveFileReference.conversationId, conversation.id))
  ).toEqual([{ key }]);
  await beginEveConversationDeletion(owner, conversation.id);
  let wrote = false;
  await expect(
    writeEveGeneratedFile(owner, conversation.id, key, () => {
      wrote = true;
      return Promise.resolve();
    })
  ).rejects.toThrow("unavailable");
  expect(wrote).toBe(false);
  await expect(
    reserveEveGeneratedFile(owner, conversation.id, "abcdefghijklmnopqrstuvwx")
  ).rejects.toThrow("unavailable");
});

test("deletion waits for an admitted generated-file write before fencing the family", async () => {
  const conversation = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "writing",
    async () => crypto.randomUUID()
  );
  const key = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  await reserveEveGeneratedFile(owner, conversation.id, key);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const writing = writeEveGeneratedFile(
    owner,
    conversation.id,
    key,
    async () => {
      entered.resolve();
      await release.promise;
      return "stored";
    }
  );
  await entered.promise;
  const deletion = beginEveConversationDeletion(owner, conversation.id);
  try {
    await expect
      .poll(async () => {
        const [row] = await db.execute<{ blocked: boolean }>(
          sql`select exists(select 1 from pg_locks where locktype = 'advisory' and not granted and classid::bigint = ((hashtextextended(${`eve-family:${owner}`}, 0) >> 32) & 4294967295) and objid::bigint = (hashtextextended(${`eve-family:${owner}`}, 0) & 4294967295)) as blocked`
        );
        return row.blocked;
      })
      .toBe(true);
  } finally {
    release.resolve();
    await writing;
    await deletion;
  }
  const [saved] = await db
    .select({ state: eveConversation.state })
    .from(eveConversation)
    .where(eq(eveConversation.id, conversation.id));
  expect(saved.state).toBe("deleting");
});

test("file purge preserves outside references and keeps durable progress across retries", async () => {
  const target = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "purge",
    async () => crypto.randomUUID()
  );
  const survivor = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "survivor",
    async () => crypto.randomUUID()
  );
  const exclusive = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  const shared = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  await registerEveStoredFile(owner, exclusive);
  await registerEveStoredFile(owner, shared);
  await referenceEveFiles(owner, target.id, [exclusive, shared]);
  await referenceEveFiles(owner, survivor.id, [shared]);
  await expect(prepareEveFamilyFilePurge(owner, target.id)).rejects.toThrow(
    "pending deletion"
  );
  await beginEveConversationDeletion(owner, target.id);
  expect(await prepareEveFamilyFilePurge(owner, target.id)).toEqual([
    exclusive,
  ]);
  expect(await prepareEveFamilyFilePurge(owner, target.id)).toEqual([
    exclusive,
  ]);
  await expect(
    referenceEveFiles(owner, survivor.id, [exclusive])
  ).rejects.toThrow("not owned");
  await completeEveFilePurge(owner, [exclusive]);
  expect(await prepareEveFamilyFilePurge(owner, target.id)).toEqual([]);
  await expect(registerEveStoredFile(owner, exclusive)).rejects.toThrow(
    "cannot be reassigned"
  );
  await referenceEveFiles(owner, survivor.id, [shared]);
  const [preserved] = await db
    .select({ state: eveStoredFile.state })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, shared));
  expect(preserved.state).toBe("active");
});

test("concurrent family cleanup cannot abandon a shared file", async () => {
  const first = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "first",
    async () => crypto.randomUUID()
  );
  const second = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "second",
    async () => crypto.randomUUID()
  );
  const key = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  await registerEveStoredFile(owner, key);
  await referenceEveFiles(owner, first.id, [key]);
  await referenceEveFiles(owner, second.id, [key]);
  await expect(releaseEveFamilyFileReferences(owner, first.id)).rejects.toThrow(
    "pending deletion"
  );
  await beginEveConversationDeletion(owner, first.id);
  await beginEveConversationDeletion(owner, second.id);
  expect(await prepareEveFamilyFilePurge(owner, first.id)).toEqual([]);
  expect(await prepareEveFamilyFilePurge(owner, second.id)).toEqual([]);
  const outcomes = await Promise.allSettled([
    releaseEveFamilyFileReferences(owner, first.id),
    releaseEveFamilyFileReferences(owner, second.id),
  ]);
  expect(
    outcomes.filter((result) => result.status === "fulfilled")
  ).toHaveLength(1);
  expect(
    outcomes.filter((result) => result.status === "rejected")
  ).toHaveLength(1);
  const references = await db
    .select()
    .from(eveFileReference)
    .where(eq(eveFileReference.key, key));
  expect(references).toHaveLength(1);
  const remaining = references[0].conversationId;
  await expect(
    releaseEveFamilyFileReferences(stranger, remaining)
  ).rejects.toThrow("pending deletion");
  expect(await prepareEveFamilyFilePurge(owner, remaining)).toEqual([key]);
  await expect(
    releaseEveFamilyFileReferences(owner, remaining)
  ).rejects.toThrow("cleanup is incomplete");
  await completeEveFilePurge(owner, [key]);
  await expect(
    completeEveConversationDeletion(owner, remaining)
  ).rejects.toThrow("content cleanup is incomplete");
  await releaseEveFamilyFileReferences(owner, remaining);
  await releaseEveFamilyFileReferences(owner, remaining);
  expect(
    await db
      .select()
      .from(eveFileReference)
      .where(eq(eveFileReference.key, key))
  ).toEqual([]);
});

test("upload reservations are durable and reject existing identities even for the same owner", async () => {
  const key = `${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}.png`;
  await reserveEveUpload(owner, key);
  await expect(reserveEveUpload(owner, key)).rejects.toThrow();
  await expect(reserveEveUpload(stranger, key)).rejects.toThrow();
  expect(
    await db
      .select({ ownerId: eveStoredFile.ownerId, state: eveStoredFile.state })
      .from(eveStoredFile)
      .where(eq(eveStoredFile.key, key))
  ).toEqual([{ ownerId: owner, state: "active" }]);
  await expect(reserveEveUpload(owner, "../file")).rejects.toThrow(
    "Invalid upload ownership"
  );
  await expect(reserveEveUpload("", key)).rejects.toThrow(
    "Invalid upload ownership"
  );
});

test("orphan cleanup retains references and young uploads and retries reappearing tombstones", async () => {
  const keys = Array.from({ length: 5 }, () =>
    crypto.randomUUID().replaceAll("-", "").slice(0, 24)
  );
  const [orphan, referenced, young, legacy, foreign] = keys;
  await Promise.all([
    reserveEveUpload(owner, orphan),
    reserveEveUpload(owner, referenced),
    reserveEveUpload(owner, young),
    reserveEveUpload(stranger, foreign),
  ]);
  await db
    .update(eveStoredFile)
    .set({ createdAt: new Date("2025-01-01") })
    .where(inArray(eveStoredFile.key, [orphan, referenced, foreign]));
  const conversation = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "retained reference",
    async () => crypto.randomUUID()
  );
  await referenceEveFiles(owner, conversation.id, [referenced]);
  const cutoff = new Date("2026-01-01");
  const fenced = await prepareEveOrphanedFilePurge(keys, cutoff);
  expect(fenced.map((file) => file.key).sort()).toEqual(
    [orphan, foreign].sort()
  );
  expect(fenced.find((file) => file.key === foreign)?.ownerId).toBe(stranger);
  expect(fenced.some((file) => file.key === legacy)).toBe(false);
  await expect(
    referenceEveFiles(owner, conversation.id, [orphan])
  ).rejects.toThrow("not owned");
  let wrote = false;
  await expect(
    writeEveUpload(owner, orphan, () => {
      wrote = true;
      return Promise.resolve();
    })
  ).rejects.toThrow("unavailable");
  expect(wrote).toBe(false);
  expect(await isEveFileUnavailable(orphan)).toBe(true);
  expect(await isEveFileUnavailable(referenced)).toBe(false);
  expect(await isEveFileUnavailable(legacy)).toBe(false);
  await completeEveFilePurge(owner, [orphan]);
  // A provider inventory discovers the same object after a delayed completion.
  expect(await prepareEveOrphanedFilePurge([orphan], cutoff)).toEqual([
    { key: orphan, ownerId: owner },
  ]);
});

test("orphan cleanup waits for an admitted upload before committing its fence", async () => {
  const key = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  await reserveEveUpload(owner, key);
  await db
    .update(eveStoredFile)
    .set({ createdAt: new Date("2025-01-01") })
    .where(eq(eveStoredFile.key, key));
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const writing = writeEveUpload(owner, key, async () => {
    entered.resolve();
    await release.promise;
    return "stored";
  });
  await entered.promise;
  const cleanup = prepareEveOrphanedFilePurge([key], new Date("2026-01-01"));
  try {
    await expect
      .poll(async () => {
        const [row] = await db.execute<{ blocked: boolean }>(
          sql`select exists(select 1 from pg_locks where locktype = 'advisory' and not granted and classid::bigint = ((hashtextextended(${`eve-family:${owner}`}, 0) >> 32) & 4294967295) and objid::bigint = (hashtextextended(${`eve-family:${owner}`}, 0) & 4294967295)) as blocked`
        );
        return row.blocked;
      })
      .toBe(true);
  } finally {
    release.resolve();
    await writing;
    await cleanup;
  }
  const [file] = await db
    .select()
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  expect(file.state).toBe("deleting");
});
