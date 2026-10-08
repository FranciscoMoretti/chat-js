/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): The setup command isolates the provider CLI in a Node child process because that CLI may exit its process; this is a Node tooling boundary.
 */
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { installEvePostgresQueueFence } from "@/lib/eve/lifecycle/postgres/eve-queue-fence";
import { installEvePostgresResourceFence } from "@/lib/eve/lifecycle/postgres/eve-resource-fence";
import postgres from "postgres";
import { resolveEveSetup } from "./eve-setup-config";
import { resolveWorkflowDatabaseUrl } from "@/lib/eve/environment";
import { resolveWorkflowWorld } from "@/lib/eve/world-config";
/* oxlint-enable import/no-nodejs-modules */

const SETUP_MODE_ARGUMENT_INDEX = 2;
const MAXIMUM_SETUP_ARGUMENT_COUNT = 3;
const READINESS_CONNECTION_TIMEOUT_MILLISECONDS = 30_000;
const NO_MISSING_TABLES = 0;

config({ path: [".env.worktree.local", ".env.local"], quiet: true });

/**
 * Validate the optional setup mode before resolving configuration.
 * @returns {string | undefined} Supplied mode; absent or empty values retain the default setup path.
 */
const readSetupMode = (): string | undefined => {
  const [mode] = process.argv.slice(SETUP_MODE_ARGUMENT_INDEX);
  if (
    process.argv.length > MAXIMUM_SETUP_ARGUMENT_COUNT ||
    (mode && !["--check", "--validate"].includes(mode))
  ) {
    throw new Error("Usage: eve-setup.ts [--check | --validate]");
  }
  return mode;
};

/**
 * Run provider migrations in a child because the provider CLI exits its process.
 * @param {string} databaseUrl Validated PostgreSQL URL for the provider setup.
 * @returns {void} Completes after the provider command, or propagates its failure.
 */
/* oxlint-disable no-console, node/no-sync, node/no-process-env -- Report migration progress, snapshot dotenv's environment, and wait for the isolated provider CLI before opening our connection. */
const prepareProviderDatabase = (databaseUrl: string): void => {
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
};
/* oxlint-enable no-console, node/no-sync, node/no-process-env */

/**
 * Resolve the world and execute only the requested synchronous preparation stage.
 * @returns {{ mode: string | undefined; setup: ReturnType<typeof resolveEveSetup> }} Validated mode and world details for the readiness phase.
 */
/* oxlint-disable no-console, node/no-process-env -- Resolve the dotenv-populated CLI environment and report the selected backend before any asynchronous readiness checks. */
const prepareEveSetupContext = (): {
  mode: string | undefined;
  setup: ReturnType<typeof resolveEveSetup>;
} => {
  const mode = readSetupMode();
  const setup = resolveEveSetup(
    resolveWorkflowWorld(),
    resolveWorkflowDatabaseUrl(process.env)
  );
  if (setup.managed) {
    console.log(
      "Workflow backend: Vercel (managed). No PostgreSQL workflow setup required."
    );
    return { mode, setup };
  }
  console.log("Workflow backend: PostgreSQL (local/self-hosted).");
  if (typeof mode !== "string" || mode === "") {
    prepareProviderDatabase(setup.databaseUrl);
  }
  return { mode, setup };
};
/* oxlint-enable no-console, node/no-process-env */

/**
 * Open the readiness connection and begin its deadline before the first await.
 * @param {string} databaseUrl Validated PostgreSQL world URL.
 * @returns {{ connection: postgres.Sql; deadline: ReturnType<typeof setTimeout> }} Client and timer owned by the caller's finally block.
 */
const openReadinessConnection = (
  databaseUrl: string
): {
  connection: postgres.Sql;
  deadline: ReturnType<typeof setTimeout>;
} => {
  const connection = postgres(databaseUrl, { connect_timeout: 10, max: 1 });
  const deadline = setTimeout(() => {
    void connection.end({ timeout: 0 });
  }, READINESS_CONNECTION_TIMEOUT_MILLISECONDS);
  return { connection, deadline };
};

/**
 * Build the provider and optional local lifecycle table manifest in query order.
 * @param {boolean} local Whether this world owns local lifecycle fences.
 * @returns {string[]} A fresh ordered table manifest for the readiness query.
 */
const requiredEveTables = (local: boolean): string[] => {
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
  return required;
};

/**
 * Reject incomplete schemas and report the supported readiness coverage.
 * @param {readonly unknown[]} missing Rows identifying requested tables missing from PostgreSQL.
 * @param {boolean} local Whether local lifecycle tables were included.
 * @returns {void} Reports readiness, or throws the command's actionable schema error.
 */
/* oxlint-disable no-console -- Report schema readiness and the hosted lifecycle coverage limit on the setup command's stdout. */
const reportSchemaReadiness = (
  missing: readonly unknown[],
  local: boolean
): void => {
  if (missing.length > NO_MISSING_TABLES) {
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
};
/* oxlint-enable no-console */

/* oxlint-disable oxc/no-async-await -- The command preserves its existing await locations for local fencing, the readiness query, and final client cleanup. */
const run = async (): Promise<void> => {
  const { mode, setup } = prepareEveSetupContext();
  if (!setup.managed && mode !== "--validate") {
    const { connection, deadline } = openReadinessConnection(setup.databaseUrl);
    try {
      if ((typeof mode !== "string" || mode === "") && setup.local) {
        await installEvePostgresResourceFence(connection);
        await installEvePostgresQueueFence(connection, "workflow_flows");
      }
      reportSchemaReadiness(
        await connection`
          select name from unnest(${requiredEveTables(setup.local)}::text[]) as name
          where to_regclass(name) is null
        `,
        setup.local
      );
    } finally {
      clearTimeout(deadline);
      await connection.end({ timeout: 1 });
    }
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */

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
