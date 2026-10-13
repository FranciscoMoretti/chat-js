import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10_000 },
  outputDir: "./tests/eve-results/presentation",
  reporter: "list",
  retries: 0,
  testDir: "./tests",
  testMatch: ["eve-message-presentation.e2e.ts", "eve-composer-states.e2e.ts"],
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
  },
  workers: 1,
});
