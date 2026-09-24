import { execFileSync } from "node:child_process";

import { config } from "dotenv";
import postgres from "postgres";

import { installEvePostgresQueueFence } from "../lib/db/eve-queue-fence";
import { installEvePostgresResourceFence } from "../lib/db/eve-resource-fence";
import { workflowWorld } from "../lib/eve/world-config";
import { resolveEveSetup } from "./eve-setup-config";

config({ path: [".env.worktree.local", ".env.local"], quiet: true });

const run = async () => {
  const [mode] = process.argv.slice(2);
  if (
    process.argv.length > 3 ||
    (mode && !["--check", "--validate"].includes(mode))
  ) {
    throw new Error("Usage: eve-setup.ts [--check | --validate]");
  }
  const databaseUrl = process.env.WORKFLOW_POSTGRES_URL;
  const { local } = resolveEveSetup(workflowWorld, databaseUrl);
  if (!databaseUrl) {
    throw new Error("Set WORKFLOW_POSTGRES_URL.");
  }
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
      { stdio: "pipe", timeout: 120_000 }
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
    if (missing.length) {
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
      safe
        ? error.message
        : "EVE setup/check failed. Check WORKFLOW_POSTGRES_URL, database permissions, TLS, and connectivity."
    );
    process.exitCode = 1;
  }
})();
