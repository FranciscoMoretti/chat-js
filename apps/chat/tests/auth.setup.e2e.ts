/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import path from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 */
import path from "node:path";

import { test as setup } from "@playwright/test";
/* oxlint-enable import/no-nodejs-modules */

const authFile = path.resolve("playwright/.auth/session.json");

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): setup("authenticate") accepts { page }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
setup("authenticate", async ({ page }) => {
  await page.goto("/api/dev-login");
  await page.waitForURL("/");
  await page.context().storageState({ path: authFile });
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
