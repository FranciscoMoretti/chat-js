import { defineConfig, devices } from "@playwright/test";

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
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
/* oxlint-enable import/no-default-export */
