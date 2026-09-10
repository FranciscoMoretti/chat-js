import { config } from "dotenv";
import postgres from "postgres";
import { z } from "zod";
import { databaseConnection, databaseEnvOptions } from "../lib/db/connection";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function checkDatabase() {
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
      max: 1,
      connect_timeout: 10,
    });
    const deadline = setTimeout(() => {
      sql.end({ timeout: 0 }).catch(() => undefined);
    }, 15_000);
    try {
      await sql`select 1`;
      console.log(`${purpose}: connection OK`);
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
      await sql.end({ timeout: 1 });
    }
  }
}

checkDatabase().catch(() => {
  console.error(
    "Database check failed. Check your connection settings in .env.local."
  );
  process.exitCode = 1;
});
