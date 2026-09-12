import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

it("skips an absent optional Redis and rejects REST credentials without exposing them", () => {
  const cwd = mkdtempSync(join(tmpdir(), "chatjs-redis-check-"));
  try {
    for (const url of [
      "",
      "https://user:private-test-secret@provider.example",
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(import.meta.resolve("tsx/cli")),
          fileURLToPath(new URL("check-redis.ts", import.meta.url)),
        ],
        {
          cwd,
          encoding: "utf-8",
          env: {
            NODE_ENV: "test",
            REDIS_URL: url,
            TSX_TSCONFIG_PATH: fileURLToPath(
              new URL("../tsconfig.json", import.meta.url)
            ),
          },
          timeout: 10_000,
        }
      );
      expect(result.status).toBe(url ? 1 : 0);
      expect(result.stdout + result.stderr).not.toContain(
        "private-test-secret"
      );
      expect(url ? result.stderr : result.stdout).toContain(
        url ? "Redis check failed" : "Redis is not configured"
      );
    }
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});
