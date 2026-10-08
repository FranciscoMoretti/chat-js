/* oxlint-disable import/no-relative-parent-imports -- Node/tsx loads this CommonJS compatibility entrypoint from the test harness and does not resolve the @ alias here; retain the package-relative module path used by the runtime test. */
import { databaseConnection, databaseEnvOptions } from "../lib/db/connection";
/* oxlint-enable import/no-relative-parent-imports */

import { config } from "dotenv";
import postgres from "postgres";
import { z } from "zod";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const CONNECT_TIMEOUT_SECONDS = 10;
const CHECK_DEADLINE_MS = 15_000;
const CLOSE_TIMEOUT_SECONDS = 1;
const DATABASE_PROBE_CONNECTION_LIMIT = 1;
const IMMEDIATE_DATABASE_CLOSE_TIMEOUT_SECONDS = 0;
const NONEMPTY_DATABASE_URL_MIN_LENGTH = 1;

interface DatabaseEnvironment {
  readonly DATABASE_URL?: string;
  readonly DATABASE_MIGRATION_URL?: string;
  readonly DATABASE_PREPARE?: boolean;
  readonly DATABASE_MAX_CONNECTIONS?: number;
}

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve the database probe's awaited query/cleanup and deadline close operations on modern configured runtimes. */
/* oxlint-disable no-console, node/no-process-env --
 * no-console (#514): This diagnostic executable reports invalid configuration and failed per-purpose connections through console.error.
 * node/no-process-env (#537): Read the dotenv-populated environment when validation starts, including the temporary-working-directory process overrides used by the maintained CLI test.
 */
const openDatabaseProbe = (
  environment: DatabaseEnvironment,
  purpose: "runtime" | "migration"
): { deadline: ReturnType<typeof setTimeout>; sql: postgres.Sql } => {
  const settings = databaseConnection(environment, purpose);
  const sql = postgres(settings.url, {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing settings.options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...settings.options,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    max: DATABASE_PROBE_CONNECTION_LIMIT,
  });
  const closeAfterDeadline = async (): Promise<void> => {
    try {
      await sql.end({ timeout: IMMEDIATE_DATABASE_CLOSE_TIMEOUT_SECONDS });
    } catch {
      // The timeout closes the client before the query result is relevant.
    }
  };
  const deadline = setTimeout(() => {
    void closeAfterDeadline();
  }, CHECK_DEADLINE_MS);
  return { deadline, sql };
};

const checkPurpose = async (
  environment: DatabaseEnvironment,
  purpose: "runtime" | "migration"
): Promise<void> => {
  const { sql, deadline } = openDatabaseProbe(environment, purpose);
  try {
    await sql`select 1`;
    process.stdout.write(`${purpose}: connection OK\n`);
  } catch {
    const variable =
      // oxlint-disable-next-line no-ternary -- Keep variable as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      purpose === "migration" &&
      typeof environment.DATABASE_MIGRATION_URL === "string"
        ? "DATABASE_MIGRATION_URL"
        : "DATABASE_URL";
    console.error(
      `${purpose}: connection failed. Check ${variable}, credentials, TLS settings, and network access. See https://www.chatjs.dev/docs/reference/database`
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    await sql.end({ timeout: CLOSE_TIMEOUT_SECONDS });
  }
};

const checkDatabase = async (): Promise<void> => {
  const parsed = z
    .object({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing databaseEnvOptions own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...databaseEnvOptions,
      DATABASE_URL: z.string().min(NONEMPTY_DATABASE_URL_MIN_LENGTH),
    })
    .safeParse(process.env);
  if (!parsed.success) {
    console.error(
      `Invalid database configuration: ${parsed.error.issues.map((issue: { readonly path: readonly PropertyKey[] }) => issue.path.join(".")).join(", ")}. Check .env.local.`
    );
    process.exitCode = 1;
    return;
  }

  await checkPurpose(parsed.data, "runtime");
  await checkPurpose(parsed.data, "migration");
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-console, node/no-process-env */

/* oxlint-disable no-console --
 * no-console (#514): The command reports invalid configuration and connection failures through console.error.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: The Node/tsx diagnostic runner loads this CommonJS-scoped entrypoint; keep its asynchronous startup inside an IIFE.
void (async (): Promise<void> => {
  try {
    await checkDatabase();
  } catch {
    console.error(
      "Database check failed. Check your connection settings in .env.local."
    );
    process.exitCode = 1;
  }
})();
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console */
