import { expect, test } from "@playwright/test";

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): test("chat page loads") accepts { page }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("chat page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("textbox")).toBeVisible();
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): test("development login tool is available on the login page") accepts { page, }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("development login tool is available on the login page", async ({
  page,
}) => {
  await page.goto("/login");

  const devLogin = page.getByRole("link", { name: "Dev login" });
  await expect(devLogin).toBeVisible();
  await expect(devLogin).toHaveAttribute("href", "/api/dev-login");
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
