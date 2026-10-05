import { defineConfig } from "@playwright/test";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import config from "./playwright.eve.config";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default defineConfig({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config.use own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...config.use,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
/* oxlint-enable import/no-default-export */
