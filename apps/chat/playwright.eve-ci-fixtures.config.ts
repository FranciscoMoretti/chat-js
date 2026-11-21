import { defineConfig } from "@playwright/test";
import presentation from "./playwright.eve-presentation.config";

// The remaining search cases visit the real chat and dev-login routes.
export const standaloneVisualCases = [
  /eve-message-delivery\.visual\.e2e\.ts .*pending delivery survives reload and clears only for its operation$/u,
  /eve-search\.visual\.e2e\.ts search states$/u,
];

export default defineConfig({
  ...presentation,
  forbidOnly: Boolean(process.env.CI),
  grep: [
    /eve-(?:composer-states|message-presentation)\.e2e\.ts /u,
    ...standaloneVisualCases,
  ],
  outputDir: "./tests/eve-results/ci-fixtures",
  testMatch: [
    "eve-message-presentation.e2e.ts",
    "eve-composer-states.e2e.ts",
    "eve-message-delivery.visual.e2e.ts",
    "eve-search.visual.e2e.ts",
  ],
  use: {
    ...presentation.use,
    baseURL: "http://browser-fixture.test",
  },
});
