import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, test } from "vitest";

const migration = await readFile(
  new URL("migrations/0022_hard_photon.sql", import.meta.url),
  "utf-8"
);

test.each(["creating", "bound", "deleting", "deleted"])(
  "retirement preserves cleanup ownership until legacy conversations are deleted: %s",
  async (state) => {
    const database = new PGlite();
    try {
      await database.exec(`
      CREATE TABLE "EveGuest" ("ownerId" text);
      CREATE TABLE "EveGuestMessage" (id text);
      CREATE TABLE "EveGuestRate" (id text);
      CREATE TABLE "EveConversation" ("ownerId" text, state text, "guestCleanupAttemptedAt" timestamp);
      INSERT INTO "EveGuest" VALUES ('visitor');
    `);
      await database.query(
        'INSERT INTO "EveConversation" ("ownerId",state) VALUES ($1,$2)',
        ["visitor", state]
      );
      if (state === "deleted") {
        await database.exec(migration);
        const result = await database.query(
          "SELECT to_regclass('public.\"EveGuest\"') AS retired"
        );
        expect(result.rows).toEqual([{ retired: null }]);
      } else {
        await expect(database.exec(migration)).rejects.toThrow(
          "Purge legacy guest conversations"
        );
        const retained = await database.query(
          'SELECT "ownerId" FROM "EveGuest"'
        );
        expect(retained.rows).toEqual([{ ownerId: "visitor" }]);
      }
    } finally {
      await database.close();
    }
  },
  // PGlite's cold WASM startup can exceed Vitest's 5s default on CI.
  20_000
);
