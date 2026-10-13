import path from "node:path";

import { test as setup } from "@playwright/test";

const reasoningFile = path.resolve("playwright/.reasoning/session.json");

setup("authenticate for reasoning", async ({ page }) => {
  await page.goto("/api/dev-login");
  await page.waitForURL("/");
  await page.context().storageState({ path: reasoningFile });
});
