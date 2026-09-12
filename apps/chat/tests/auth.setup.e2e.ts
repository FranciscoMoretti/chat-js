import path from "node:path";

import { test as setup } from "@playwright/test";

const authFile = path.resolve("playwright/.auth/session.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/api/dev-login");
  await page.waitForURL("/");
  await page.context().storageState({ path: authFile });
});
