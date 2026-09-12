import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: "visual",
      snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
      testMatch: /\.visual\.e2e\.ts$/u,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
