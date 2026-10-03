import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: "visual",
      snapshotPathTemplate:
        "{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}",
      testMatch: /\.visual\.e2e\.ts$/u,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
/* oxlint-enable import/no-default-export */
