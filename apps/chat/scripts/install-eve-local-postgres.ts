import { execFileSync } from "node:child_process";

import { config } from "dotenv";
import postgres from "postgres";

import { installEvePostgresQueueFence } from "../lib/db/eve-queue-fence";
import { installEvePostgresResourceFence } from "../lib/db/eve-resource-fence";

config({ path: [".env.worktree.local", ".env.local"], quiet: true });

const databaseUrl = process.env.WORKFLOW_POSTGRES_URL;
if (!databaseUrl) {
  throw new Error("Set WORKFLOW_POSTGRES_URL to the local EVE database.");
}
const target = new URL(databaseUrl);
if (
  !(
    ["postgres:", "postgresql:"].includes(target.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
  )
) {
  throw new Error("This setup command only supports local Postgres.");
}
// Bootstrap the pinned provider before installing ChatJS lifecycle receipts.
// The provider CLI exits the process, so run it in an isolated child.
execFileSync(
  process.execPath,
  [
    "-e",
    'import("@workflow/world-postgres/cli").then(({ setupDatabase }) => setupDatabase())',
  ],
  { stdio: "inherit" }
);
const connection = postgres(databaseUrl, { max: 1 });
try {
  // Explicit setup only; request handlers never create or alter provider tables.
  await installEvePostgresResourceFence(connection);
  await installEvePostgresQueueFence(connection, "workflow_flows");
  console.log("Installed EVE local Postgres deletion fences and receipts.");
} finally {
  await connection.end();
}
