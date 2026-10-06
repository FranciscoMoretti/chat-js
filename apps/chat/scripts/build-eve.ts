/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This executable uses node:child_process to run Bun/EVE commands and node:path to resolve the application and guest working directories.
 */
import { spawnSync } from "node:child_process";
/* oxlint-disable sort-imports -- Pinned Oxfmt keeps node:child_process before node:path by module specifier, while sort-imports orders the local bindings path before spawnSync. */
import path from "node:path";
/* oxlint-enable sort-imports */

import { resolveWorkflowWorld } from "@/lib/eve/world-config";
/* oxlint-enable import/no-nodejs-modules */

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
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): spawnSync status 0 is the Node child-process success value; treat every other status, including null after a signal, as failure.
 */
if (backendCheck.status !== 0) {
  throw new Error(
    "Workflow backend compatibility check failed. Run application migrations and verify the database backend before deploying."
  );
}
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, node/no-sync --
 * no-magic-numbers (#517): spawnSync status 0 is the Node child-process success value; treat every other status, including null after a signal, as failure.
 * node/no-sync (#538): Build the application and guest roots sequentially, inheriting each child's stdio and checking its status before advancing.
 */
for (const root of [".", "guest"]) {
  const result = spawnSync("bun", ["x", "eve", "build"], {
    cwd: path.resolve(process.cwd(), root),
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`EVE build failed for ${root}`, { cause: result.error });
  }
}
/* oxlint-enable no-magic-numbers, node/no-sync */
