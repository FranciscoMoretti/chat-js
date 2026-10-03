import { defineConfig, devices } from "@playwright/test";

/* oxlint-disable import/no-default-export, no-magic-numbers, node/no-process-env, typescript/strict-boolean-expressions --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 * no-magic-numbers (#517): default export uses 3000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * node/no-process-env (#537): default export reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/strict-boolean-expressions (#610): default export intentionally keeps the existing falsy-value behavior of process.env.PORT; distinguishing empty, zero, and absent states requires a domain behavior decision.
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
    ...devices["Desktop Chrome"],
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
    baseURL: `http://localhost:${process.env.PORT || 3000}`,
  },
  workers: 1,
});
/* oxlint-enable import/no-default-export, no-magic-numbers, node/no-process-env, typescript/strict-boolean-expressions */
