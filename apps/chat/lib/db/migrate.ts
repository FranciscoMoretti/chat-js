/* oxlint-disable import/no-nodejs-modules  --
 * import/no-nodejs-modules (#529): This server/tooling module requires import path from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
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
/* oxlint-enable import/no-nodejs-modules */

config({
  path: ".env.local",
});

/* oxlint-disable max-lines-per-function, max-statements, no-console, no-magic-numbers, node/no-process-env, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * max-lines-per-function (#510): runMigrate keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): runMigrate keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): runMigrate emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): runMigrate uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): runMigrate derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * node/no-process-env (#537): runMigrate reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * oxc/no-async-await (#540): runMigrate sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): runMigrate accepts entry; migration; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): runMigrate intentionally keeps the existing falsy-value behavior of historyProblem; titleIndex; usageIndex; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const runMigrate = async (): Promise<void> => {
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
    // Existing chat rows can be large: build outside Drizzle's transaction so
    // regular chat writes remain available during rollout.
    const [titleIndex] = await connection<{ valid: boolean }[]>`
      select indisvalid as valid from pg_index
      where indexrelid = to_regclass('public."EveChat_search_title"')
    `;
    if (titleIndex && !titleIndex.valid) {
      // An interrupted concurrent build leaves an invalid index; retry it.
      await connection.unsafe('DROP INDEX CONCURRENTLY "EveChat_search_title"');
    }
    await connection.unsafe(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "EveChat_search_title"
       ON "EveChat" USING gin (to_tsvector('simple', "title"))`
    );
    const [usageIndex] = await connection<{ valid: boolean }[]>`
      select indisvalid as valid from pg_index
      where indexrelid = to_regclass('public."EveUsage_unpriced_owner"')
    `;
    if (usageIndex && !usageIndex.valid) {
      await connection.unsafe(
        'DROP INDEX CONCURRENTLY "EveUsage_unpriced_owner"'
      );
    }
    await connection.unsafe(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "EveUsage_unpriced_owner"
       ON "EveUsage" USING btree ("ownerId") WHERE "costUsd" IS NULL`
    );
  } finally {
    await connection.end();
  }
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");
};
/* oxlint-enable max-lines-per-function, max-statements, no-console, no-magic-numbers, node/no-process-env, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-console, typescript/explicit-function-return-type  --
 * no-console (#514): void (async () => { try { await runMigrate(); } catch ( emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * oxc/no-async-await (#540): void (async () => { try { await runMigrate(); } catch ( sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep void (async () => { try { await runMigrate(); } catch ('s return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: This entrypoint also runs through tsx in CommonJS packages, which cannot compile top-level await.
void (async () => {
  try {
    await runMigrate();
  } catch (error) {
    console.error("❌ Migration failed");
    console.error(error);
    process.exitCode = 1;
  }
})();
/* oxlint-enable no-console, typescript/explicit-function-return-type */
