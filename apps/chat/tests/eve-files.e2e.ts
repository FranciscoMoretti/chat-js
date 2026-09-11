import { eq, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";
import { db } from "../lib/db/client";
import {
  referenceEveFiles,
  registerEveStoredFile,
  reserveEveGeneratedFile,
  writeEveGeneratedFile,
} from "../lib/db/eve-files";
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
    undefined,
    undefined,
    { conversationId: root.id, beforeTurnId: "turn_0" }
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
      undefined,
      "attachment-fixture",
      undefined,
      [key]
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
