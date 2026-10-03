import { defineConfig } from "@playwright/test";

import config from "./playwright.eve.config";

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
// Run against the normal application with an unauthenticated browser.
export default defineConfig({
  ...config,
  testMatch: "eve-disposable-guest.e2e.ts",
});
/* oxlint-enable import/no-default-export */
