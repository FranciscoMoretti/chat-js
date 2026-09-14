import { expect, test } from "@playwright/test";

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
