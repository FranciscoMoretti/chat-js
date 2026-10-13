import evePackage from "eve/package.json";
import postgres from "postgres";

import { databaseConnection } from "@/lib/db/connection";
import { ensureWorkflowBackend } from "@/lib/db/workflow-backend";
import {
  assertEvePostgresRuntimeCompatibility,
  resolveEveStepVersion,
} from "@/lib/db/workflow-runtime-compatibility";
import { resolveWorkflowDatabaseUrl } from "@/lib/eve/environment";
import { resolveWorkflowWorld } from "@/lib/eve/world-config";

const checkPostgresRuntime = async (): Promise<void> => {
  const workflowSettings = databaseConnection(
    {
      DATABASE_URL: resolveWorkflowDatabaseUrl(process.env),
    },
    "migration"
  );
  const workflowConnection = postgres(
    workflowSettings.url,
    workflowSettings.options
  );
  try {
    await assertEvePostgresRuntimeCompatibility(
      workflowConnection,
      resolveEveStepVersion(evePackage.name, evePackage.version)
    );
  } finally {
    await workflowConnection.end();
  }
};

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
    if (world === "@workflow/world-postgres") {
      await checkPostgresRuntime();
    }
    await ensureWorkflowBackend(connection, world);
  } finally {
    await connection.end();
  }
};
void (async () => {
  try {
    await check();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
