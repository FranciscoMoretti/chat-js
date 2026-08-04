import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 4321);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    colorScheme: "light",
    timezoneId: "UTC",
    locale: "en-US",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `bun run preview -- --host 127.0.0.1 --port ${port}`,
        url: `${baseURL}/docs`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
