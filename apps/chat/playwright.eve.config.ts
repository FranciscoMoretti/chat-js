import { defineConfig, devices } from "@playwright/test";

// Runs against an already started local ChatJS app and deterministic Eve worker.
export default defineConfig({
  testDir: "./tests",
  testMatch: "eve-browser.e2e.ts",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  outputDir: "./tests/eve-results/playwright",
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${process.env.PORT || 3000}`,
  },
});
