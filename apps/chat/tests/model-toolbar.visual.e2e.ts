import { expect, test } from "@playwright/test";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("model selector visual fixture") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): test("model selector visual fixture") accepts { page }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("model selector visual fixture", async ({ page }) => {
  await page.goto("/visual-fixtures/model-toolbar");

  // Next's cached route tree can retain a hidden copy of this fixture.
  const fixture = page.locator('[data-testid="model-toolbar-fixture"]:visible');
  const selector = fixture.getByTestId("model-selector");

  await expect(fixture).toBeVisible();
  await expect(selector).toHaveText("Primary fixture model");
  await expect(fixture).toHaveScreenshot("model-toolbar-closed.png");

  await selector.click();
  await expect(page.getByPlaceholder("Search models...")).toBeVisible();
  await expect(
    page.getByText("Reasoning fixture model", { exact: true })
  ).toBeVisible();
  await expect(fixture).toHaveScreenshot("model-selector-open.png");

  await selector.click();
  await expect(page.getByPlaceholder("Search models...")).toBeHidden();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types */
