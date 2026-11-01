import { databaseConnection } from "@/lib/db/connection";
import { ensureWorkflowBackend } from "@/lib/db/workflow-backend";
import postgres from "postgres";
import { resolveWorkflowWorld } from "@/lib/eve/world-config";

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
void (async (): Promise<void> => {
  try {
    await check();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
