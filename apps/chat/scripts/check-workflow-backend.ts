import postgres from "postgres";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { databaseConnection } from "@/lib/db/connection";
/* oxlint-enable sort-imports */
import { ensureWorkflowBackend } from "@/lib/db/workflow-backend";
import { resolveWorkflowWorld } from "@/lib/eve/world-config";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve check's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): check reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
const check = async (): Promise<void> => {
  const world = resolveWorkflowWorld();
  const settings = databaseConnection(
    {
      DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    "migration"
  );
  const connection = postgres(settings.url, settings.options);
  try {
    await ensureWorkflowBackend(connection, world);
  } finally {
    await connection.end();
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable node/no-process-env */
/* oxlint-disable no-console --
 * no-console (#514): void (async () => { try { await check(); } catch (error emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: build-eve invokes this entrypoint through tsx in a CommonJS package; top-level await cannot compile there.
void (async (): Promise<void> => {
  try {
    await check();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console */
