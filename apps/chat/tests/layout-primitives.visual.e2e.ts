import { expect, test } from "@playwright/test";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements --
 * max-statements (#512): test("layout primitives visual fixture") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.goto(), locator.click(), locator.click() on the original Page/locator receiver to change the live browser or route state.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
