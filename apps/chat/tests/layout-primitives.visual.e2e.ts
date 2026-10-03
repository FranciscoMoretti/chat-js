import { expect, test } from "@playwright/test";

/* oxlint-disable max-statements, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("layout primitives visual fixture") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): test("layout primitives visual fixture") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("layout primitives visual fixture") accepts { page }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("layout primitives visual fixture", async ({ page }) => {
  await page.goto("/visual-fixtures/layout-primitives");

  const fixture = page.getByTestId("layout-primitives-fixture");
  // Full-page captures include the dev indicator; wait for compilation to settle.
  const devActivity = page
    .locator("nextjs-portal")
    .getByText(/Compiling|Rendering/u);
  await expect(fixture).toBeVisible();
  await expect(fixture).toHaveScreenshot("layout-primitives-closed.png");

  await page.getByRole("button", { name: "Open alert" }).click();
  await expect(page.getByText("Delete project?")).toBeVisible();
  await expect(devActivity).toBeHidden();
  await expect(page).toHaveScreenshot("layout-primitives-alert-open.png");

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByText("Project settings")).toBeVisible();
  await expect(devActivity).toBeHidden();
  await expect(page).toHaveScreenshot("layout-primitives-dialog-open.png");

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Open sheet" }).click();
  await expect(page.getByText("Inspector")).toBeVisible();
  await expect(devActivity).toBeHidden();
  await expect(page).toHaveScreenshot("layout-primitives-sheet-open.png");
});
/* oxlint-enable max-statements, oxc/no-async-await, typescript/prefer-readonly-parameter-types */
