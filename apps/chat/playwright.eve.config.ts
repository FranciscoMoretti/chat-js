import { registerHooks } from "node:module";
import { defineConfig, devices } from "@playwright/test";

// Playwright loads app TypeScript as CommonJS. The storage SDK publishes only
// import conditions, including its provider subpaths. Node 24 can load these.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "files-sdk" || specifier.startsWith("files-sdk/")) {
      return nextResolve(specifier, {
        ...context,
        conditions: [...context.conditions, "import"],
      });
    }
    return nextResolve(specifier, context);
  },
});

const DEFAULT_PORT = 3000;

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
    baseURL: `http://localhost:${(process.env.PORT ?? "") || DEFAULT_PORT}`,
  },
  workers: 1,
});
