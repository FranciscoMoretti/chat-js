import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

/* oxlint-disable import/no-default-export, oxc/no-rest-spread-properties --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 * oxc/no-rest-spread-properties (#543): default export copies or separates ...baseConfig; ...devices["Desktop Chrome"] while preserving existing object ownership; mutating source objects is not equivalent.
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
/* oxlint-enable import/no-default-export, oxc/no-rest-spread-properties */
