import { defineConfig } from "@playwright/test";

import config from "./playwright.eve.config";

/* oxlint-disable import/no-default-export  --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 * oxc/no-rest-spread-properties (#543): default export copies or separates ...config while preserving existing object ownership; mutating source objects is not equivalent.
 */
// Run against the normal application with an unauthenticated browser.
export default defineConfig({
  ...config,
  testMatch: "eve-disposable-guest.e2e.ts",
});
/* oxlint-enable import/no-default-export */
