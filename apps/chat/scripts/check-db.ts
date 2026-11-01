import { databaseConnection, databaseEnvOptions } from "../lib/db/connection";

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

const openDatabaseProbe = (
  environment: DatabaseEnvironment,
  purpose: "runtime" | "migration"
): { deadline: ReturnType<typeof setTimeout>; sql: postgres.Sql } => {
  const settings = databaseConnection(environment, purpose);
  const sql = postgres(settings.url, {
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
