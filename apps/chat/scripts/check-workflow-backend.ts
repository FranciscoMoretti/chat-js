import postgres from "postgres";

import { databaseConnection } from "../lib/db/connection";
import { resolvePreviewDatabaseEnvironment } from "../lib/db/preview-environment";
import { ensureWorkflowBackend } from "../lib/db/workflow-backend";
import { resolveWorkflowWorld } from "../lib/eve/world-config";

const check = async () => {
  const world = resolveWorkflowWorld();
  const settings = databaseConnection(
    {
      DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
      DATABASE_URL: process.env.DATABASE_URL,
      ...resolvePreviewDatabaseEnvironment(process.env),
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
void (async () => {
  try {
    await check();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
