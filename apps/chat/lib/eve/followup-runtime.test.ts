import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("loads the authored followup hook in the standalone Node runtime", () => {
  // No React server conditions or module mocks: EVE evaluates this graph in Node.
  // Unreachable database URLs also ensure importing does not perform database work.
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      'await import("./agent/hooks/followup-suggestions.ts")',
    ],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      encoding: "utf-8",
      env: {
        ...process.env,
        AUTH_SECRET: "followup-runtime-test-secret",
        DATABASE_URL: "postgres://test:test@127.0.0.1:1/test",
        EVE_GATEWAY_SECRET: "followup-runtime-test-secret-at-least-32",
        WORKFLOW_POSTGRES_URL: "postgres://test:test@127.0.0.1:1/test",
      },
      timeout: 10_000,
    }
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
});
