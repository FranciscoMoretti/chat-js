import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default defineConfig({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing baseConfig own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...baseConfig,
  projects: [
    {
      name: "visual",
      snapshotPathTemplate:
        "{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}",
      testMatch: /\.visual\.e2e\.ts$/u,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of devices["Desktop Chrome"] rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
/* oxlint-enable import/no-default-export */
