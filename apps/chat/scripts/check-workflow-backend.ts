/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/connection"; "../lib/db/workflow-backend"; "../lib/eve/world-config" dependency within this package instead of introducing an alias or barrel API.
 */
import postgres from "postgres";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { databaseConnection } from "../lib/db/connection";
/* oxlint-enable sort-imports */
import { ensureWorkflowBackend } from "../lib/db/workflow-backend";
import { resolveWorkflowWorld } from "../lib/eve/world-config";
/* oxlint-enable import/no-relative-parent-imports */

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
/* oxlint-enable node/no-process-env */
/* oxlint-disable no-console, typescript/explicit-function-return-type --
 * no-console (#514): void (async () => { try { await check(); } catch (error emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * typescript/explicit-function-return-type (#560): Keep void (async () => { try { await check(); } catch (error's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: build-eve invokes this entrypoint through tsx in a CommonJS package; top-level await cannot compile there.
void (async () => {
  try {
    await check();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
/* oxlint-enable no-console, typescript/explicit-function-return-type */
