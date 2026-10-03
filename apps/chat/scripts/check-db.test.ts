/* oxlint-disable import/no-nodejs-modules  --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; import { mkdtempSync, rmSync } from "node:fs";; import { tmpdir } from "node:os";; import path from "node:path";; import { fileURLToPath } from "node:url";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync --
 * max-statements (#512): it("reports failed endpoint names without exposing connection credentials") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("reports failed endpoint names without exposing connection credentials") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): it("reports failed endpoint names without exposing connection credentials") uses mkdtempSync(path.join(tmpdir(), "chatjs-check-db-")); execFileSync( process.execPath, [ fileURLToPath(import.meta.resolve("tsx/c; rmSync(cwd, { force: true, recursive: true }) within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 */
it("reports failed endpoint names without exposing connection credentials", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "chatjs-check-db-"));
  try {
    let failed = false;
    try {
      execFileSync(
        process.execPath,
        [
          fileURLToPath(import.meta.resolve("tsx/cli")),
          fileURLToPath(new URL("check-db.ts", import.meta.url)),
        ],
        {
          cwd,
          env: {
            DATABASE_MIGRATION_URL:
              "postgres://user:secret-migration@127.0.0.1:1/app",
            DATABASE_URL: "postgres://user:secret-runtime@127.0.0.1:1/app",
            NODE_ENV: "test",
          },
          stdio: "pipe",
          timeout: 10_000,
        }
      );
    } catch (error) {
      failed = true;
      if (!(error instanceof Error && "stderr" in error && "status" in error)) {
        throw error;
      }
      expect(error.status).toBe(1);
      const output = String(error.stderr);
      expect(output).toContain("runtime: connection failed");
      expect(output).toContain("DATABASE_MIGRATION_URL");
      expect(output).not.toContain("secret-");
      expect(output).not.toContain("postgres://");
    }
    expect(failed).toBe(true);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});
/* oxlint-enable max-statements, no-magic-numbers, node/no-sync */
