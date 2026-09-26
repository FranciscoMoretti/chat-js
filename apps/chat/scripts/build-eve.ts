import { spawnSync } from "node:child_process";
import path from "node:path";

import { resolveWorkflowWorld } from "../lib/eve/world-config";

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
if (backendCheck.status !== 0) {
  throw new Error(
    "Workflow backend compatibility check failed. Run application migrations and verify the database backend before deploying."
  );
}

for (const root of [".", "guest"]) {
  const result = spawnSync("bun", ["x", "eve", "build"], {
    cwd: path.resolve(process.cwd(), root),
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`EVE build failed for ${root}`, { cause: result.error });
  }
}
