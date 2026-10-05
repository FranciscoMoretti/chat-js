/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/connection" dependency within this package instead of introducing an alias or barrel API.
 */
import { config } from "dotenv";
import postgres from "postgres";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { databaseConnection, databaseEnvOptions } from "../lib/db/connection";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const CONNECT_TIMEOUT_SECONDS = 10;
const CHECK_DEADLINE_MS = 15_000;
const CLOSE_TIMEOUT_SECONDS = 1;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve checkDatabase's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-console, no-magic-numbers, node/no-process-env, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return --
 * max-lines-per-function (#510): checkDatabase keeps runtime and migration connection checks with their deadline and cleanup; explicit Promise return annotations put this cohesive operation at 51 lines.
 * max-statements (#512): checkDatabase keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): checkDatabase emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): checkDatabase uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * node/no-process-env (#537): checkDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/prefer-readonly-parameter-types (#565): checkDatabase accepts issue; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): checkDatabase intentionally keeps the existing falsy-value behavior of parsed.data.DATABASE_MIGRATION_URL; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * typescript/strict-void-return (#611): checkDatabase's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
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
      `Invalid database configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}. Check .env.local.`
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
    // oxlint-disable-next-line typescript/no-misused-promises -- #585: The deadline asynchronously closes the SQL connection before signaling failure; preserving timeout cleanup requires this callback lifecycle.
    const deadline = setTimeout(async () => {
      try {
        await sql.end({ timeout: 0 });
      } catch {
        // The timeout closes the client before the query result is relevant.
      }
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
  };

  await checkPurpose("runtime");
  await checkPurpose("migration");
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-console, no-magic-numbers, node/no-process-env, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */

/* oxlint-disable no-console, typescript/explicit-function-return-type --
 * no-console (#514): void (async () => { try { await checkDatabase(); } catc emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * typescript/explicit-function-return-type (#560): Keep void (async () => { try { await checkDatabase(); } catc's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: The Node/tsx diagnostic runner loads this CommonJS-scoped entrypoint; keep its asynchronous startup inside an IIFE.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console, typescript/explicit-function-return-type */
