import { defineConfig } from "@playwright/test";

import config from "./playwright.eve.config";

// Run against the normal application with an unauthenticated browser.
export default defineConfig({
  ...config,
  testMatch: "eve-disposable-guest.e2e.ts",
});
