import { defineConfig } from "@playwright/test";

import config from "./playwright.eve.config";

export default defineConfig({
  ...config,
  outputDir: "./tests/eve-results/ui-parity",
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}",
  testMatch: [
    "eve-logical-chat.e2e.ts",
    "eve-comparison-ui.e2e.ts",
    "eve-optimistic-create.e2e.ts",
    "eve-project-ui.e2e.ts",
    "eve-project-routing.e2e.ts",
    "eve-metadata.e2e.ts",
    "eve-document-auto-open.e2e.ts",
    "eve-document-tools.e2e.ts",
    "eve-document-run.e2e.ts",
    "eve-header-parity.e2e.ts",
    "eve-loading.e2e.ts",
  ],
  timeout: 120_000,
  use: {
    ...config.use,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
