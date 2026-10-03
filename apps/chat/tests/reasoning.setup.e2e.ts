/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import path from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 */
import path from "node:path";

import { test as setup } from "@playwright/test";
/* oxlint-enable import/no-nodejs-modules */

const reasoningFile = path.resolve("playwright/.reasoning/session.json");

/* oxlint-disable oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * oxc/no-async-await (#540): setup("authenticate for reasoning") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): setup("authenticate for reasoning") accepts { page }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
setup("authenticate for reasoning", async ({ page }) => {
  await page.goto("/api/dev-login");
  await page.waitForURL("/");
  await page.context().storageState({ path: reasoningFile });
});
/* oxlint-enable oxc/no-async-await, typescript/prefer-readonly-parameter-types */
