import postgres from "postgres";

import { databaseConnection } from "../lib/db/connection";
import { ensureWorkflowBackend } from "../lib/db/workflow-backend";
import { resolveWorkflowWorld } from "../lib/eve/world-config";

const check = async () => {
  const world = resolveWorkflowWorld();
  if (world !== "vercel") {
    return;
  }
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
void (async () => {
  try {
    await check();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
