import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

it("reports failed endpoint names without exposing connection credentials", () => {
  const cwd = mkdtempSync(join(tmpdir(), "chatjs-check-db-"));
  try {
    let failed = false;
    try {
      execFileSync(
        process.execPath,
        [
          fileURLToPath(import.meta.resolve("tsx/cli")),
          fileURLToPath(new URL("./check-db.ts", import.meta.url)),
        ],
        {
          cwd,
          env: {
            NODE_ENV: "test",
            DATABASE_URL: "postgres://user:secret-runtime@127.0.0.1:1/app",
            DATABASE_MIGRATION_URL:
              "postgres://user:secret-migration@127.0.0.1:1/app",
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
    rmSync(cwd, { recursive: true, force: true });
  }
});
