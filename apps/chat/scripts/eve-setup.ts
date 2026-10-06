/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "@/lib/eve/lifecycle/postgres/eve-queue-fence"; "@/lib/eve/lifecycle/postgres/eve-resource-fence"; "../lib/eve/environment"; "../lib/eve/world-config" dependency within this package instead of introducing an alias or barrel API.
 */
import { execFileSync } from "node:child_process";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config } from "dotenv";
/* oxlint-enable sort-imports */
import postgres from "postgres";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installEvePostgresQueueFence } from "@/lib/eve/lifecycle/postgres/eve-queue-fence";
/* oxlint-enable sort-imports */
import { installEvePostgresResourceFence } from "@/lib/eve/lifecycle/postgres/eve-resource-fence";

import { resolveWorkflowDatabaseUrl } from "../lib/eve/environment";
import { resolveWorkflowWorld } from "../lib/eve/world-config";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { resolveEveSetup } from "./eve-setup-config";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

config({ path: [".env.worktree.local", ".env.local"], quiet: true });

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve run's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-console, no-magic-numbers, node/no-process-env, node/no-sync --
 * max-lines-per-function (#510): run keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): run keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): run emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): run uses 2, 3, 30_000, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * node/no-process-env (#537): run reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * node/no-sync (#538): run uses execFileSync( process.execPath, [ "-e", 'import("@workflow/world-postgre within its synchronous startup or SDK contract; asynchronous conversion changes its callers and lifecycle.
 */
const run = async (): Promise<void> => {
  const [mode] = process.argv.slice(2);
  if (
    process.argv.length > 3 ||
    (mode && !["--check", "--validate"].includes(mode))
  ) {
    throw new Error("Usage: eve-setup.ts [--check | --validate]");
  }
  const setup = resolveEveSetup(
    resolveWorkflowWorld(),
    resolveWorkflowDatabaseUrl(process.env)
  );
  if (setup.managed) {
    console.log(
      "Workflow backend: Vercel (managed). No PostgreSQL workflow setup required."
    );
    return;
  }
  const { databaseUrl, local } = setup;
  console.log("Workflow backend: PostgreSQL (local/self-hosted).");
  if (mode === "--validate") {
    return;
  }
  if (!mode) {
    console.log("Preparing the configured EVE PostgreSQL world...");
    // The provider CLI exits the process, so isolate it from our lifecycle setup.
    execFileSync(
      process.execPath,
      [
        "-e",
        'import("@workflow/world-postgres/cli").then(({ setupDatabase }) => setupDatabase())',
      ],
      {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing process.env own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        env: { ...process.env, WORKFLOW_POSTGRES_URL: databaseUrl },
        stdio: "pipe",
        timeout: 120_000,
      }
    );
  }
  const connection = postgres(databaseUrl, { connect_timeout: 10, max: 1 });
  const deadline = setTimeout(() => {
    void connection.end({ timeout: 0 });
  }, 30_000);
  try {
    if (!mode && local) {
      await installEvePostgresResourceFence(connection);
      await installEvePostgresQueueFence(connection, "workflow_flows");
    }
    const required = [
      "workflow.workflow_runs",
      "workflow.workflow_events",
      "workflow.workflow_event_slots",
      "workflow.workflow_steps",
      "workflow.workflow_hooks",
      "workflow.workflow_waits",
      "workflow.workflow_stream_chunks",
      "graphile_worker._private_jobs",
    ];
    if (local) {
      required.push(
        "workflow.eve_resource_fences",
        "workflow.eve_session_retirements",
        "workflow.eve_queue_tasks"
      );
    }
    const missing = await connection`
      select name from unnest(${required}::text[]) as name
      where to_regclass(name) is null
    `;
    if (missing.length > 0) {
      throw new Error(
        "EVE schema is incomplete. Run eve:setup with a database role allowed to apply migrations."
      );
    }
    console.log("EVE PostgreSQL connection and required tables are ready.");
    if (!local) {
      console.log(
        "Hosted lifecycle/deletion verification remains required; this command checks provider schema readiness only."
      );
    }
  } finally {
    clearTimeout(deadline);
    await connection.end({ timeout: 1 });
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-console, no-magic-numbers, node/no-process-env, node/no-sync */

/* oxlint-disable no-console, typescript/explicit-function-return-type --
 * no-console (#514): void (async () => { try { await run(); } catch (error)  emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * typescript/explicit-function-return-type (#560): Keep void (async () => { try { await run(); } catch (error) 's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: This entrypoint also runs through tsx in CommonJS packages, which cannot compile top-level await.
void (async () => {
  try {
    await run();
  } catch (error) {
    // Database/child-process errors can contain connection details. Never print them.
    const safe =
      error instanceof Error &&
      (error.message.startsWith("ChatJS setup") ||
        error.message.startsWith("Set WORKFLOW") ||
        error.message.startsWith("WORKFLOW_POSTGRES_URL must") ||
        error.message.startsWith("Usage:") ||
        error.message.startsWith("EVE schema"));
    console.error(
      // oxlint-disable-next-line no-ternary -- Keep console.error argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      safe
        ? error.message
        : "EVE setup/check failed. Check WORKFLOW_POSTGRES_URL, database permissions, TLS, and connectivity."
    );
    process.exitCode = 1;
  }
})();
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console, typescript/explicit-function-return-type */
