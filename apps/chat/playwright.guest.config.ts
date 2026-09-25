import { defineConfig } from "@playwright/test";

import config from "./playwright.eve.config";

// Run against CHATJS_GUEST_ONLY=true with DATABASE_URL and WORKFLOW_POSTGRES_URL unset.
export default defineConfig({
  ...config,
  testMatch: "eve-disposable-guest.e2e.ts",
});
