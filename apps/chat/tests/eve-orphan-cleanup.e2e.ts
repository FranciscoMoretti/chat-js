import { createEveTestSession } from "./eve-native-session.fixture";

import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { prepareEveOrphanedFilePurge } from "../lib/db/eve-orphaned-files";
import { referenceEveFiles, reserveEveUpload } from "../lib/db/eve-files";
import { createEveConversation } from "../lib/db/eve-queries";
import {
  eveConversation,
  eveChat,
  eveFileReference,
  eveStoredFile,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { keyFromFileUrl } from "../lib/file-url";
import { assertEveTestDatabase } from "./eve-test-database";
// Keep this as the final static import to preserve prior dependency evaluation order.
// oxfmt-ignore
import { cleanupEveOrphanedFiles } from "../lib/eve/cleanup-orphaned-files";

const storage = vi.hoisted(() => ({
  fail: false,
  objects: new Map<string, Date>(),
}));

vi.mock("../lib/file-storage", () => ({
  deleteFilesByUrls: (urls: readonly string[]): void => {
    if (storage.fail) {
      throw new Error("Provider unavailable");
    }
    for (const url of urls) {
      storage.objects.delete(keyFromFileUrl(url) ?? "");
    }
  },
  *iterateStoredFiles() {
    for (const [pathname, uploadedAt] of storage.objects) {
      yield { pathname, uploadedAt };
    }
  },
}));

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("the complete sweep preserves legacy/referenced files and recovers failed deletion and late writes", async () => {
  const owner = crypto.randomUUID();
  const [orphan, referenced, legacy, young] = Array.from({ length: 4 }, () =>
    crypto.randomUUID().replaceAll("-", "").slice(0, 24)
  );
  const old = new Date("2025-01-01");
  const cutoff = new Date("2026-01-01");
  await db.insert(user).values({
    email: `${owner}@test.invalid`,
    id: owner,
    name: "Orphan sweep fixture",
  });
  try {
    await Promise.all(
      [orphan, referenced, young].map(async (key) => {
        await reserveEveUpload(owner, key);
      })
    );
    await db
      .update(eveStoredFile)
      .set({ createdAt: old })
      .where(eq(eveStoredFile.ownerId, owner));
    const conversation = await createEveConversation(
      owner,
      crypto.randomUUID(),
      "retain attachment",
      createEveTestSession
    );
    await referenceEveFiles(owner, conversation.id, [referenced]);
    for (const key of [orphan, referenced, legacy]) {
      storage.objects.set(key, old);
    }
    storage.objects.set(young, new Date("2026-01-02"));
    storage.fail = true;
    await expect(cleanupEveOrphanedFiles(cutoff)).rejects.toThrow("incomplete");
    expect(storage.objects.has(orphan)).toBe(true);
    const state = async () => {
      const storedFiles = await db
        .select({ state: eveStoredFile.state })
        .from(eveStoredFile)
        .where(eq(eveStoredFile.key, orphan));
      return storedFiles[0].state;
    };
    expect(await state()).toBe("deleting");
    storage.fail = false;
    expect(await cleanupEveOrphanedFiles(cutoff)).toEqual({
      deletedCount: 1,
      skipped: false,
    });
    expect(await state()).toBe("deleted");
    expect([...storage.objects.keys()].toSorted()).toEqual(
      [referenced, legacy, young].toSorted()
    );
    // An uncertain upload finishes after the previous deletion acknowledgement.
    storage.objects.set(orphan, old);
    expect(await cleanupEveOrphanedFiles(cutoff)).toEqual({
      deletedCount: 1,
      skipped: false,
    });
    expect(storage.objects.has(orphan)).toBe(false);
    expect(await state()).toBe("deleted");
    expect(await cleanupEveOrphanedFiles(cutoff)).toEqual({
      deletedCount: 0,
      skipped: false,
    });
  } finally {
    storage.objects.clear();
    storage.fail = false;
    await db
      .delete(eveFileReference)
      .where(eq(eveFileReference.ownerId, owner));
    await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
    await db.delete(eveStoredFile).where(eq(eveStoredFile.ownerId, owner));
    await db.delete(user).where(eq(user.id, owner));
  }
});

test("a multi-owner fence waits for family writers and rechecks references before committing", async () => {
  const owners = [crypto.randomUUID(), crypto.randomUUID()];
  const keys = [crypto.randomUUID(), crypto.randomUUID()];
  const conversationId = crypto.randomUUID();
  const cutoff = new Date("2026-01-01");
  const query = postgres(env.DATABASE_URL, { max: 2 });
  let pendingPurge: ReturnType<typeof prepareEveOrphanedFilePurge> | undefined;
  await db.insert(user).values(
    owners.map((id) => ({
      email: `${id}@test.invalid`,
      id,
      name: "Multi-owner orphan fixture",
    }))
  );
  try {
    await db.insert(eveChat).values({
      id: conversationId,
      ownerId: owners[1],
      title: "Retain attachment",
    });
    await db.insert(eveConversation).values({
      chatId: conversationId,
      id: conversationId,
      ownerId: owners[1],
      firstMessage: "Retain attachment",
      operationId: conversationId,
      sessionId: conversationId,
      state: "bound",
    });
    await db.insert(eveStoredFile).values(
      keys.map((key, index) => ({
        createdAt: new Date("2025-01-01"),
        key,
        ownerId: owners[index],
      }))
    );
    await query.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${owners[1]}`}, 0))`;
      pendingPurge = prepareEveOrphanedFilePurge(keys, cutoff);
      // Keep a rejection observed while this transaction deliberately blocks it.
      void pendingPurge.catch(() => {
        // Assert the original promise after this transaction releases its lock.
      });
      await expect
        .poll(async () => {
          const rows = await query<
            { waiting: number }[]
          >`select count(*)::int as waiting from pg_locks
          where locktype = 'advisory' and not granted`;
          return rows[0].waiting;
        })
        .toBe(1);
      await tx`insert into "EveFileReference" ("conversationId", "key", "ownerId")
        values (${conversationId}, ${keys[1]}, ${owners[1]})`;
    });
    await expect(pendingPurge).resolves.toEqual([
      { key: keys[0], ownerId: owners[0] },
    ]);
    const files = await db
      .select({ key: eveStoredFile.key, state: eveStoredFile.state })
      .from(eveStoredFile)
      .where(inArray(eveStoredFile.key, keys));
    expect(files).toEqual(
      expect.arrayContaining([
        { key: keys[0], state: "deleting" },
        { key: keys[1], state: "active" },
      ])
    );
    await expect(
      Promise.all([
        prepareEveOrphanedFilePurge(keys, cutoff),
        prepareEveOrphanedFilePurge(keys.toReversed(), cutoff),
      ])
    ).resolves.toEqual([
      [{ key: keys[0], ownerId: owners[0] }],
      [{ key: keys[0], ownerId: owners[0] }],
    ]);
  } finally {
    await pendingPurge?.catch(() => {
      // Drain any failed purge before removing its fixtures.
    });
    await db
      .delete(eveFileReference)
      .where(inArray(eveFileReference.ownerId, owners));
    await db
      .delete(eveConversation)
      .where(eq(eveConversation.id, conversationId));
    await db.delete(eveChat).where(eq(eveChat.id, conversationId));
    await db
      .delete(eveStoredFile)
      .where(inArray(eveStoredFile.ownerId, owners));
    await db.delete(user).where(inArray(user.id, owners));
    await query.end();
  }
});
