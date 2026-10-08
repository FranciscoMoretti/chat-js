import { expect, test } from "@playwright/test";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.goto() on the original Page/locator receiver to change the live browser or route state.
test("chat page loads for reasoning session", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("textbox")).toBeVisible();
});
/* oxlint-enable oxc/no-async-await */
