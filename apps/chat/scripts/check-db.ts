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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve checkDatabase's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-console, no-magic-numbers, node/no-process-env --
 * max-lines-per-function (#510): checkDatabase keeps runtime and migration connection checks with their deadline and cleanup; explicit Promise return annotations put this cohesive operation at 51 lines.
 * max-statements (#512): checkDatabase keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): checkDatabase emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): checkDatabase uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * node/no-process-env (#537): checkDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
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

  const checkPurpose = async (
    purpose: "runtime" | "migration"
  ): Promise<void> => {
    const settings = databaseConnection(parsed.data, purpose);
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
    try {
      await sql`select 1`;
      process.stdout.write(`${purpose}: connection OK\n`);
    } catch {
      const variable =
        // oxlint-disable-next-line no-ternary -- Keep variable as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        purpose === "migration" &&
        typeof parsed.data.DATABASE_MIGRATION_URL === "string"
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

  await checkPurpose("runtime");
  await checkPurpose("migration");
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-console, no-magic-numbers, node/no-process-env */

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
