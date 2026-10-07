import { defineConfig } from "@playwright/test";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import config from "./playwright.eve.config";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
// Run against the normal application with an unauthenticated browser.
export default defineConfig({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...config,
  testMatch: "eve-disposable-guest.e2e.ts",
});
/* oxlint-enable import/no-default-export */
