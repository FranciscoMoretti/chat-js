import { createEveTestSession } from "./eve-native-session.fixture";

import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { referenceEveFiles, reserveEveUpload } from "../lib/db/eve-files";
import { createEveConversation } from "../lib/db/eve-queries";
import {
  eveConversation,
  eveFileReference,
  eveStoredFile,
  user,
} from "../lib/db/schema";
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
  deleteFilesByUrls:
    /* oxlint-disable eslint/require-await -- This native fixture callback performs synchronous per-call work but its receiving API requires a Promise; precomputing the result would change invocation-time state or side effects. */
    async (urls: readonly string[]): Promise<void> => {
      if (storage.fail) {
        throw new Error("Provider unavailable");
      }
      for (const url of urls) {
        storage.objects.delete(keyFromFileUrl(url) ?? "");
      }
    },
  /* oxlint-enable eslint/require-await */
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
