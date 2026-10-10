import { defineConfig, devices } from "@playwright/test";

const DEFAULT_PORT = 3000;

/* oxlint-disable import/no-default-export, node/no-process-env --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 * node/no-process-env (#537): default export reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing devices["Desktop Chrome"] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${(process.env.PORT ?? "") || DEFAULT_PORT}`,
  },
  workers: 1,
});
/* oxlint-enable import/no-default-export, node/no-process-env */
