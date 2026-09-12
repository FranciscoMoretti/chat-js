import { defineConfig, devices } from "@playwright/test";
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config } from "dotenv";

config({
  path: ".env.local",
});
/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = process.env.PORT || 3000;
/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = `http://localhost:${PORT}`;
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  expect: {
    timeout: 60 * 1000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Configure projects */
  projects: [
    {
      name: "chat",
      testMatch: /chat.e2e.ts/u,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "reasoning",
      testMatch: /reasoning.e2e.ts/u,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "artifacts",
      testMatch: /artifacts.e2e.ts/u,
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
