/* oxlint-disable eslint/no-await-in-loop -- Database migrations must run in journal order. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, test } from "vitest";
import { z } from "zod";

const migrationsDirectory = `${import.meta.dirname}/`;
const legacyEveFirstTimestamp = 1_788_866_915_307;
const legacyEveFinalTimestamp = 1_789_290_141_016;
const legacyEveFinalHash =
  "77eecfeabb65884e3f75de5289f306e9d5d2d7d354a6bcbd856e69178524abb3";

const journalSchema = z.object({
  entries: z.array(
    z.object({
      idx: z.number().int(),
      tag: z.string(),
      when: z.number().int(),
    })
  ),
});
const snapshotTableSchema = z.object({
  checkConstraints: z.record(z.string(), z.unknown()),
  columns: z.record(
    z.string(),
    z.object({ name: z.string(), notNull: z.boolean() })
  ),
  compositePrimaryKeys: z.record(z.string(), z.unknown()),
  foreignKeys: z.record(z.string(), z.unknown()),
  indexes: z.record(z.string(), z.unknown()),
  uniqueConstraints: z.record(z.string(), z.unknown()),
});
const finalSnapshotSchema = z.object({
  tables: z.record(z.string(), snapshotTableSchema),
});

const journal = journalSchema.parse(
  JSON.parse(readFileSync(`${migrationsDirectory}meta/_journal.json`, "utf-8"))
);
const finalSnapshot = finalSnapshotSchema.parse(
  JSON.parse(
    readFileSync(`${migrationsDirectory}meta/0048_snapshot.json`, "utf-8")
  )
);
const consolidatedSql = readFileSync(
  `${migrationsDirectory}0046_eve_runtime.sql`,
  "utf-8"
);
const postgresIdentifier = (identifier: string) => identifier.slice(0, 63);
const runMigrations = (database: PGlite) =>
  migrate(drizzle(database), { migrationsFolder: migrationsDirectory });

const initializeAtMain = async () => {
  const database = new PGlite();
  await database.exec(`
    CREATE SCHEMA drizzle;
    CREATE TABLE drizzle.__drizzle_migrations (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  for (const entry of journal.entries.filter(({ idx }) => idx <= 45)) {
    const migrationSql = readFileSync(
      `${migrationsDirectory}${entry.tag}.sql`,
      "utf-8"
    );
    await database.exec(migrationSql);
    await database.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [createHash("sha256").update(migrationSql).digest("hex"), entry.when]
    );
  }

  return database;
};

const expectedEveTables = Object.entries(finalSnapshot.tables)
  .filter(([key]) => key.startsWith("public.Eve"))
  .map(([key, table]) => ({ key, table }));

describe("consolidated EVE migration", () => {
  test("creates the final EVE schema from main", async () => {
    const database = await initializeAtMain();
    try {
      await runMigrations(database);

      const actualColumns = await database.query<{
        column_name: string;
        is_nullable: "NO" | "YES";
        table_name: string;
      }>(`
          SELECT table_name, column_name, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name LIKE 'Eve%'
          ORDER BY table_name, ordinal_position
        `);
      const expectedColumns = expectedEveTables
        .flatMap(({ key, table }) =>
          Object.values(table.columns).map((column) => ({
            column_name: column.name,
            is_nullable: column.notNull ? "NO" : "YES",
            table_name: key.slice("public.".length),
          }))
        )
        .toSorted((left, right) =>
          `${left.table_name}.${left.column_name}`.localeCompare(
            `${right.table_name}.${right.column_name}`
          )
        );

      expect(
        actualColumns.rows.toSorted((left, right) =>
          `${left.table_name}.${left.column_name}`.localeCompare(
            `${right.table_name}.${right.column_name}`
          )
        )
      ).toEqual(expectedColumns);

      const expectedIndexes = [
        ...expectedEveTables.flatMap(({ table }) => Object.keys(table.indexes)),
        "Project_id_user_idx",
      ].toSorted();
      const actualIndexes = await database.query<{ indexname: string }>(`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
        `);
      expect(
        actualIndexes.rows
          .map(({ indexname }) => indexname)
          .filter((name) => expectedIndexes.includes(name))
          .toSorted()
      ).toEqual(expectedIndexes);

      const expectedConstraints = expectedEveTables
        .flatMap(({ table }) => [
          ...Object.keys(table.checkConstraints),
          ...Object.keys(table.compositePrimaryKeys),
          ...Object.keys(table.foreignKeys),
          ...Object.keys(table.uniqueConstraints),
        ])
        .map(postgresIdentifier)
        .toSorted();
      const actualConstraints = await database.query<{ conname: string }>(`
          SELECT conname
          FROM pg_constraint
        `);
      expect(
        actualConstraints.rows
          .map(({ conname }) => conname)
          .filter((name) => expectedConstraints.includes(name))
          .toSorted()
      ).toEqual(expectedConstraints);

      const highWater = await database.query<{ created_at: string }>(`
          SELECT created_at
          FROM drizzle.__drizzle_migrations
          ORDER BY created_at DESC
          LIMIT 1
        `);
      expect(Number(highWater.rows[0]?.created_at)).toBe(
        journal.entries.at(-1)?.when
      );
    } finally {
      await database.close();
    }
  }, 20_000);

  test("preserves data after the complete legacy EVE sequence", async () => {
    const database = await initializeAtMain();
    try {
      await database.exec(consolidatedSql);
      await database.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [legacyEveFinalHash, legacyEveFinalTimestamp]
      );
      await database.exec(`
          INSERT INTO "user" (id, name, email, email_verified)
          VALUES ('preserved-user', 'Preserved', 'preserved@example.test', false);
          INSERT INTO "EveConversation" ("ownerId", "operationId", "firstMessage", state)
          VALUES ('preserved-user', '00000000-0000-4000-8000-000000000001', 'keep me', 'ready');
        `);

      await runMigrations(database);

      const preserved = await database.query<{ firstMessage: string }>(`
          SELECT "firstMessage"
          FROM "EveConversation"
          WHERE "ownerId" = 'preserved-user'
        `);
      expect(preserved.rows).toEqual([{ firstMessage: "keep me" }]);
      const highWater = await database.query<{ created_at: string }>(`
          SELECT created_at
          FROM drizzle.__drizzle_migrations
          ORDER BY created_at DESC
          LIMIT 1
        `);
      expect(Number(highWater.rows[0]?.created_at)).toBe(
        journal.entries.at(-1)?.when
      );
    } finally {
      await database.close();
    }
  }, 20_000);

  test("rejects partial legacy history before changing schema or history", async () => {
    const database = await initializeAtMain();
    try {
      await database.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        ["partial-development-history", legacyEveFirstTimestamp]
      );
      const historyBefore = await database.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM drizzle.__drizzle_migrations`
      );

      await expect(runMigrations(database)).rejects.toThrow(
        "Partial unreleased EVE migration history detected"
      );

      const eveTables = await database.query<{ count: number }>(`
          SELECT count(*)::integer AS count
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name LIKE 'Eve%'
        `);
      const historyAfter = await database.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM drizzle.__drizzle_migrations`
      );
      expect(eveTables.rows).toEqual([{ count: 0 }]);
      expect(historyAfter.rows).toEqual(historyBefore.rows);
    } finally {
      await database.close();
    }
  }, 20_000);
});
