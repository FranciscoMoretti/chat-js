import path from "node:path";

import { config } from "dotenv";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { databaseConnection } from "./connection";
import {
  getMigrationHistoryProblem,
  KNOWN_CHATJS_TABLE_NAMES,
} from "./migration-history";

config({
  path: ".env.local",
});

const runMigrate = async () => {
  // Deployment builds preserve the Vercel preview safeguard. Explicit db:migrate
  // runs on every host and never relies on a deployment vendor's environment.
  if (
    process.argv.includes("--deployment") &&
    process.env.VERCEL_ENV !== "production"
  ) {
    console.log(
      "Skipping automatic migrations outside a production Vercel deployment"
    );
    return;
  }

  const settings = databaseConnection(
    {
      DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    "migration"
  );
  const connection = postgres(settings.url, settings.options);
  const db = drizzle(connection);
  const migrationsFolder = path.resolve(process.cwd(), "lib/db/migrations");

  console.log("⏳ Running migrations...");

  const start = Date.now();
  try {
    const migrations = readMigrationFiles({ migrationsFolder });
    if (migrations.length === 0) {
      throw new Error("Expected at least one EVE database migration.");
    }

    const [{ migrationTableExists }] = await connection.unsafe<
      { migrationTableExists: boolean }[]
    >(
      `select to_regclass('drizzle.__drizzle_migrations') is not null as "migrationTableExists"`
    );
    const applied = migrationTableExists
      ? await connection.unsafe<{ createdAt: string; hash: string }[]>(
          `select "created_at"::text as "createdAt", "hash"
           from "drizzle"."__drizzle_migrations"
           order by "created_at"`
        )
      : [];
    const [{ hasChatJsTables }] = await connection<
      { hasChatJsTables: boolean }[]
    >`
      select exists (
        select 1
        from pg_tables
        where schemaname = 'public'
          and tablename in ${connection([...KNOWN_CHATJS_TABLE_NAMES])}
      ) as "hasChatJsTables"
    `;
    const historyProblem = getMigrationHistoryProblem({
      applied: applied.map((entry) => ({
        createdAt: Number(entry.createdAt),
        hash: entry.hash,
      })),
      available: migrations.map((migration) => ({
        createdAt: migration.folderMillis,
        hash: migration.hash,
      })),
      hasChatJsTables,
    });
    if (historyProblem) {
      throw new Error(
        `${historyProblem}\n\nMigrations stopped before changing the database. Keep this database untouched if it contains EVE data. Create a backup, provision a fresh empty database for this EVE-only scaffold, and update DATABASE_URL and DATABASE_MIGRATION_URL to that database before retrying.`
      );
    }

    await migrate(db, { migrationsFolder });
  } finally {
    await connection.end();
  }
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");
};

void (async () => {
  try {
    await runMigrate();
  } catch (error) {
    console.error("❌ Migration failed");
    console.error(error);
    process.exitCode = 1;
  }
})();
