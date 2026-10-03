import { expect, test } from "@playwright/test";

/* oxlint-disable oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * oxc/no-async-await (#540): test("chat page loads for reasoning session") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("chat page loads for reasoning session") accepts { page }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("chat page loads for reasoning session", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("textbox")).toBeVisible();
});
/* oxlint-enable oxc/no-async-await, typescript/prefer-readonly-parameter-types */
