/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): The setup command isolates the provider CLI in a Node child process because that CLI may exit its process; this is a Node tooling boundary.
 */
import { execFileSync } from "node:child_process";

/* oxlint-disable sort-imports -- Pinned Oxfmt orders imports by module specifier, while sort-imports requires a different position by binding syntax/name; formatting the lint-sorted order restores this diagnostic. */
import { config } from "dotenv";
/* oxlint-enable sort-imports */
import postgres from "postgres";

import { resolveWorkflowDatabaseUrl } from "@/lib/eve/environment";
/* oxlint-disable sort-imports -- Pinned Oxfmt orders imports by module specifier, while sort-imports requires a different position by binding syntax/name; formatting the lint-sorted order restores this diagnostic. */
import { installEvePostgresQueueFence } from "@/lib/eve/lifecycle/postgres/eve-queue-fence";
/* oxlint-enable sort-imports */
import { installEvePostgresResourceFence } from "@/lib/eve/lifecycle/postgres/eve-resource-fence";
import { resolveWorkflowWorld } from "@/lib/eve/world-config";

/* oxlint-disable sort-imports -- Pinned Oxfmt orders imports by module specifier, while sort-imports requires a different position by binding syntax/name; formatting the lint-sorted order restores this diagnostic. */
import { resolveEveSetup } from "./eve-setup-config";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

config({ path: [".env.worktree.local", ".env.local"], quiet: true });

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve run's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-console, no-magic-numbers, node/no-process-env, node/no-sync --
 * max-lines-per-function (#510): run owns CLI argument/environment selection, optional provider setup, local fencing, required-table verification and connection cleanup; extracting its mode-dependent order across helpers risks separating one command lifecycle.
 * max-statements (#512): run performs the conditional provider setup before mode-dependent connection checks, then fences local workflows, verifies tables and closes the client; there is no independently reused operation to extract from this one entrypoint.
 * no-console (#514): run reports selected backend, setup progress and schema readiness on this CLI's stdout; removing those messages changes its command output contract.
 * no-magic-numbers (#517): 2 and 3 select/limit the script arguments, 30_000 is the connection deadline in milliseconds, and 0 requests immediate client shutdown; these values define this command flow.
 * node/no-process-env (#537): run reads the CLI's dotenv-populated process.env once to resolve the selected world and database URL; this is the script's environment boundary.
 * node/no-sync (#538): The provider setup CLI may exit its child process; execFileSync isolates that lifecycle and ensures setup completes before PostgreSQL checks begin.
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

/* oxlint-disable no-console --
 * no-console (#514): The entrypoint prints safe validation messages verbatim and maps potentially secret-bearing database/provider errors to a fixed generic message.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: This entrypoint also runs through tsx in CommonJS packages, which cannot compile top-level await.
void (async (): Promise<void> => {
  try {
    await run();
  } catch (error) {
    // Database/child-process errors can contain connection details. Never print them.
    if (
      error instanceof Error &&
      (error.message.startsWith("ChatJS setup") ||
        error.message.startsWith("Set WORKFLOW") ||
        error.message.startsWith("WORKFLOW_POSTGRES_URL must") ||
        error.message.startsWith("Usage:") ||
        error.message.startsWith("EVE schema"))
    ) {
      console.error(error.message);
    } else {
      console.error(
        "EVE setup/check failed. Check WORKFLOW_POSTGRES_URL, database permissions, TLS, and connectivity."
      );
    }
    process.exitCode = 1;
  }
})();
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console */
