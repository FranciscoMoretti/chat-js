import { defineConfig } from "@playwright/test";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import config from "./playwright.eve.config";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
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
/* oxlint-enable import/no-default-export */
