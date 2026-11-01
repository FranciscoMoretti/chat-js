import { resolveWorkflowWorld } from "@/lib/eve/world-config";
import { spawnSync } from "node:child_process";

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

const result = spawnSync("bun", ["x", "eve", "build"], {
  stdio: "inherit",
});
if (result.status !== PROCESS_SUCCESS_STATUS) {
  throw new Error("EVE build failed", { cause: result.error });
}
