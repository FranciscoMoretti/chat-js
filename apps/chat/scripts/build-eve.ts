import { spawnSync } from "node:child_process";
import path from "node:path";

import { resolveWorkflowWorld } from "../lib/eve/world-config";

console.log(
  `Workflow backend: ${resolveWorkflowWorld() === "vercel" ? "Vercel (managed)" : "PostgreSQL (local/self-hosted)"}`
);

for (const root of [".", "guest"]) {
  const result = spawnSync("bun", ["x", "eve", "build"], {
    cwd: path.resolve(process.cwd(), root),
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`EVE build failed for ${root}`, { cause: result.error });
  }
}
