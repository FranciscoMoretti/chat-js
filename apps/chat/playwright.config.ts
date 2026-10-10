import { defineConfig, devices } from "@playwright/test";
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config } from "dotenv";

config({
  path: ".env.local",
});
const DEFAULT_PORT = 3000;
/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): PORT reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = (process.env.PORT ?? "") || DEFAULT_PORT;
/* oxlint-enable node/no-process-env */
/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = `http://localhost:${PORT}`;
const CI_RETRIES = 2;
const LOCAL_RETRIES = 1;
const CI_WORKERS = 1;
/* oxlint-disable import/no-default-export, no-undefined, node/no-process-env --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 * no-undefined (#519): default export uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * node/no-process-env (#537): default export reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  expect: {
    timeout: 60_000,
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of devices["Desktop Chrome"] rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "reasoning",
      testMatch: "reasoning.e2e.ts",
      use: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of devices["Desktop Chrome"] rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "artifacts",
      testMatch: "artifacts.e2e.ts",
      use: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of devices["Desktop Chrome"] rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "visual",
      snapshotPathTemplate:
        "{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}",
      testMatch: /\.visual\.e2e\.ts$/u,
      use: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of devices["Desktop Chrome"] rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
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
  // oxlint-disable-next-line no-ternary -- Keep retries as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  retries: (process.env.CI ?? "") === "" ? LOCAL_RETRIES : CI_RETRIES,
  testDir: "./tests",
  /* Configure global timeout for each test */
  timeout: 60_000,
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
    reuseExistingServer: (process.env.CI ?? "") === "",
    timeout: 120_000,
    url: baseURL,
  },
  /* Opt out of parallel tests on CI. */
  // oxlint-disable-next-line no-ternary -- Keep workers as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  workers: (process.env.CI ?? "") === "" ? undefined : CI_WORKERS,
});
/* oxlint-enable import/no-default-export, no-undefined, node/no-process-env */
