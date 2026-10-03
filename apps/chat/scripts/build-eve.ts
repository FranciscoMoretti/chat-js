/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { spawnSync } from "node:child_process";; import path from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/eve/world-config" dependency within this package instead of introducing an alias or barrel API.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { resolveWorkflowWorld } from "../lib/eve/world-config";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable no-console --
 * no-console (#514): console.log emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 */
console.log(
  `Workflow backend: ${resolveWorkflowWorld() === "vercel" ? "Vercel (managed)" : "PostgreSQL (local/self-hosted)"}`
);
/* oxlint-enable no-console */

/* oxlint-disable node/no-sync --
 * node/no-sync (#538): backendCheck uses spawnSync( "bun", ["x", "tsx", "scripts/check-workflow-backend.ts"], { stdio: "inheri within its synchronous startup or SDK contract; asynchronous conversion changes its callers and lifecycle.
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
 * no-magic-numbers (#517): if (backendCheck.status !== 0) { throw new Error( "Work uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
if (backendCheck.status !== 0) {
  throw new Error(
    "Workflow backend compatibility check failed. Run application migrations and verify the database backend before deploying."
  );
}
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, node/no-sync --
 * no-magic-numbers (#517): for (const root of [".", "guest"]) { const result = spa uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * node/no-sync (#538): for (const root of [".", "guest"]) { const result = spa uses spawnSync("bun", ["x", "eve", "build"], { cwd: path.resolve(process.cwd(), root), std within its synchronous startup or SDK contract; asynchronous conversion changes its callers and lifecycle.
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
