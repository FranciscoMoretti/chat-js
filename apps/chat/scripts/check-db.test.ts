/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test uses Node child-process, filesystem, OS, path, and URL APIs to run check-db.ts from a fresh temporary working directory, inspect its exit status and stderr, and clean up the directory; these operations require the Node CLI test boundary.
 */
import { execFileSync } from "node:child_process";
/* oxlint-disable sort-imports -- Pinned Oxfmt orders imports by module specifier, while sort-imports requires a different position by binding syntax; formatting the lint-sorted order restores this diagnostic. */
import { mkdtempSync, rmSync } from "node:fs";
/* oxlint-enable sort-imports */
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Pinned Oxfmt orders imports by module specifier, while sort-imports requires a different position by binding name; formatting the lint-sorted order restores this diagnostic. */
import path from "node:path";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Pinned Oxfmt orders imports by module specifier, while sort-imports requires a different position by binding name; formatting the lint-sorted order restores this diagnostic. */
import { fileURLToPath } from "node:url";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Pinned Oxfmt orders imports by module specifier, while sort-imports requires a different position by binding syntax; formatting the lint-sorted order restores this diagnostic. */
import { expect, it } from "vitest";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-statements, no-magic-numbers, node/no-sync --
 * max-statements (#512): This single scenario has 16 statements across fixture creation, child invocation, error narrowing, assertions, and cleanup; one-use helpers would add indirection without creating a reusable test contract.
 * no-magic-numbers (#517): The test asserts child-process exit status 1, the exact failure status reported by the CLI; a named constant would not remove the magic-number diagnostic.
 * node/no-sync (#538): The test synchronously creates/removes its temporary directory and waits for the CLI subprocess so the exit status and stderr are available before cleanup; an async rewrite needs awaited filesystem and subprocess error handling.
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
