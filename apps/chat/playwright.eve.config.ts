import { defineConfig, devices } from "@playwright/test";

// Runs against an already started local ChatJS app and deterministic Eve worker.
export default defineConfig({
  expect: { timeout: 20_000 },
  outputDir: "./tests/eve-results/playwright",
  reporter: "list",
  retries: 0,
  testDir: "./tests",
  testMatch: "eve-browser.e2e.ts",
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
    baseURL: `http://localhost:${process.env.PORT || 3000}`,
  },
  workers: 1,
});
