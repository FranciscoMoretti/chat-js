import { config } from "dotenv";
import postgres from "postgres";
import { z } from "zod";

import { databaseConnection, databaseEnvOptions } from "../lib/db/connection";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const CONNECT_TIMEOUT_SECONDS = 10;
const CHECK_DEADLINE_MS = 15_000;
const CLOSE_TIMEOUT_SECONDS = 1;

const checkDatabase = async () => {
  const parsed = z
    .object({
      ...databaseEnvOptions,
      DATABASE_URL: z.string().min(1),
    })
    .safeParse(process.env);
  if (!parsed.success) {
    console.error(
      `Invalid database configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}. Check .env.local.`
    );
    process.exitCode = 1;
    return;
  }

  for (const purpose of ["runtime", "migration"] as const) {
    const settings = databaseConnection(parsed.data, purpose);
    const sql = postgres(settings.url, {
      ...settings.options,
      connect_timeout: CONNECT_TIMEOUT_SECONDS,
      max: 1,
    });
    const deadline = setTimeout(() => {
      sql.end({ timeout: 0 }).catch(() => {
        // The timeout closes the client before the query result is relevant.
      });
    }, CHECK_DEADLINE_MS);
    try {
      await sql`select 1`;
      process.stdout.write(`${purpose}: connection OK\n`);
    } catch {
      const variable =
        purpose === "migration" && parsed.data.DATABASE_MIGRATION_URL
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
  }
};

void (async () => {
  try {
    await checkDatabase();
  } catch {
    console.error(
      "Database check failed. Check your connection settings in .env.local."
    );
    process.exitCode = 1;
  }
})();
