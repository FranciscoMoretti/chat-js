/* oxlint-disable-next-line import/no-nodejs-modules -- This Playwright setup file uses Node's path resolver under the Node test runner. */
import path from "node:path";

// oxlint-disable-next-line sort-imports -- Keep Playwright's type-only fixture contract separate from its runtime test binding.
import { test as setup } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep Playwright type-only imports separate from runtime bindings; moving them has no runtime module-order effect.

const authFile = path.resolve("playwright/.auth/session.json");

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve setup's awaited sequencing and rejected-Promise behavior. */
setup(
  "authenticate",
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.goto() on the original Page/locator receiver to change the live browser or route state.
  async ({ page }) => {
    await page.goto("/api/dev-login");
    await page.waitForURL("/");
    await page.context().storageState({ path: authFile });
  }
);
/* oxlint-enable oxc/no-async-await */
