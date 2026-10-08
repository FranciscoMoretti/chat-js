/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This executable uses node:child_process to run Bun/EVE commands and node:path to resolve the application and guest working directories.
 */
import path from "node:path";
import { resolveWorkflowWorld } from "@/lib/eve/world-config";
import { spawnSync } from "node:child_process";
/* oxlint-enable import/no-nodejs-modules */

const PROCESS_SUCCESS_STATUS = 0;

/* oxlint-disable no-console --
 * no-console (#514): write the selected backend to CLI stdout before starting the compatibility check and EVE builds.
 */
console.log(
  // oxlint-disable-next-line no-ternary -- Keep backend selection in the template interpolation; direct if/else triggers pinned unicorn/prefer-ternary.
  `Workflow backend: ${resolveWorkflowWorld() === "vercel" ? "Vercel (managed)" : "PostgreSQL (local/self-hosted)"}`
);
/* oxlint-enable no-console */

/* oxlint-disable node/no-sync --
 * node/no-sync (#538): Wait for the compatibility subprocess to finish before checking its status and starting either EVE build; inherit its stdio in this CLI.
 */
const backendCheck = spawnSync(
  "bun",
  ["x", "tsx", "scripts/check-workflow-backend.ts"],
  {
    stdio: "inherit",
  }
);
/* oxlint-enable node/no-sync */
if (backendCheck.status !== PROCESS_SUCCESS_STATUS) {
  throw new Error(
    "Workflow backend compatibility check failed. Run application migrations and verify the database backend before deploying."
  );
}

/* oxlint-disable node/no-sync --
 * node/no-sync (#538): Build the application and guest roots sequentially, inheriting each child's stdio and checking its status before advancing.
 */
for (const root of [".", "guest"]) {
  const result = spawnSync("bun", ["x", "eve", "build"], {
    cwd: path.resolve(process.cwd(), root),
    stdio: "inherit",
  });
  if (result.status !== PROCESS_SUCCESS_STATUS) {
    throw new Error(`EVE build failed for ${root}`, { cause: result.error });
  }
}
/* oxlint-enable node/no-sync */
