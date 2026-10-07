import { config } from "dotenv";
import postgres from "postgres";
import { z } from "zod";

/* oxlint-disable import/no-relative-parent-imports -- Node/tsx loads this CommonJS compatibility entrypoint from the test harness and does not resolve the @ alias here; retain the package-relative module path used by the runtime test. */
/* oxlint-disable sort-imports -- Pinned Oxfmt keeps external imports before the local module, while Oxlint sort-imports requires multiple named bindings before single-binding imports; formatting the lint-sorted order restores this diagnostic. */
import { databaseConnection, databaseEnvOptions } from "../lib/db/connection";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const CONNECT_TIMEOUT_SECONDS = 10;
const CHECK_DEADLINE_MS = 15_000;
const CLOSE_TIMEOUT_SECONDS = 1;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve the database probe's awaited query/cleanup and deadline close operations on modern configured runtimes. */
/* oxlint-disable no-console, no-magic-numbers, node/no-process-env --
 * no-console (#514): This diagnostic executable reports invalid configuration and failed per-purpose connections through console.error.
 * no-magic-numbers (#517): Probe construction uses one connection and deadline closure uses timeout zero; URL validation requires a nonempty string and CLI failures set standard exit status one.
 * node/no-process-env (#537): Read the dotenv-populated environment when validation starts, including the temporary-working-directory process overrides used by the maintained CLI test.
 */
const openDatabaseProbe = (
  environment: Parameters<typeof databaseConnection>[0],
  purpose: "runtime" | "migration"
): { deadline: ReturnType<typeof setTimeout>; sql: postgres.Sql } => {
  const settings = databaseConnection(environment, purpose);
  const sql = postgres(settings.url, {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing settings.options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...settings.options,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    max: 1,
  });
  const closeAfterDeadline = async (): Promise<void> => {
    try {
      await sql.end({ timeout: 0 });
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
  environment: Parameters<typeof databaseConnection>[0],
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
      DATABASE_URL: z.string().min(1),
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
/* oxlint-enable no-console, no-magic-numbers, node/no-process-env */

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
