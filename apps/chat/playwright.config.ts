import { defineConfig, devices } from "@playwright/test";
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config } from "dotenv";

config({
  path: ".env.local",
});
/* oxlint-disable no-magic-numbers, node/no-process-env, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): PORT uses 3000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * node/no-process-env (#537): PORT reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/strict-boolean-expressions (#610): PORT intentionally keeps the existing falsy-value behavior of process.env.PORT; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/* Use process.env.PORT by default and fallback to port 3000 */
// oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
const PORT = process.env.PORT || 3000;
/* oxlint-enable no-magic-numbers, node/no-process-env, typescript/strict-boolean-expressions */
/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = `http://localhost:${PORT}`;
/* oxlint-disable import/no-default-export, no-magic-numbers, no-undefined, node/no-process-env, typescript/strict-boolean-expressions  --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 * no-magic-numbers (#517): default export uses 60, 1000, 2, 1, 120 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): default export derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): default export uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * node/no-process-env (#537): default export reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * oxc/no-rest-spread-properties (#543): default export copies or separates ...devices["Desktop Chrome"] while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/strict-boolean-expressions (#610): default export intentionally keeps the existing falsy-value behavior of process.env.CI; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  expect: {
    timeout: 60 * 1000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: Boolean(process.env.CI),
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Configure projects */
  projects: [
    {
      name: "chat",
      testMatch: "chat.e2e.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "reasoning",
      testMatch: "reasoning.e2e.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "artifacts",
      testMatch: "artifacts.e2e.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "visual",
      snapshotPathTemplate:
        "{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}",
      testMatch: /\.visual\.e2e\.ts$/u,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  testDir: "./tests",
  /* Configure global timeout for each test */
  timeout: 60 * 1000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },
  /* Run your local dev server before starting the tests */
  webServer: {
    command: "bun dev",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    url: baseURL,
  },
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
});
/* oxlint-enable import/no-default-export, no-magic-numbers, no-undefined, node/no-process-env, typescript/strict-boolean-expressions */
