import path from "node:path";
import { config } from "dotenv";
import { resolveWorkflowWorld } from "@/lib/eve/world-config";
import { spawnSync } from "node:child_process";

config({ path: [".env.local", ".env"], quiet: true });

const PROCESS_SUCCESS_STATUS = 0;

console.log(
  `Workflow backend: ${resolveWorkflowWorld() === "vercel" ? "Vercel (managed)" : "PostgreSQL (local/self-hosted)"}`
);

const backendCheck = spawnSync(
  "bun",
  ["x", "tsx", "scripts/check-workflow-backend.ts"],
  {
    stdio: "inherit",
  }
);
if (backendCheck.status !== PROCESS_SUCCESS_STATUS) {
  throw new Error(
    "Workflow backend compatibility check failed. Run application migrations and verify the database backend before deploying."
  );
}

for (const root of [".", "guest"]) {
  const result = spawnSync("bun", ["x", "eve", "build"], {
    cwd: path.resolve(process.cwd(), root),
    stdio: "inherit",
  });
  if (result.status !== PROCESS_SUCCESS_STATUS) {
    throw new Error(`EVE build failed for ${root}`, { cause: result.error });
  }
}
