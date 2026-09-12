import { expect, test } from "@playwright/test";

test("model selector and artifact toolbar visual fixture", async ({ page }) => {
  await page.goto("/visual-fixtures/model-toolbar");

  const fixture = page.getByTestId("model-toolbar-fixture");
  const selector = page.getByTestId("model-selector");
  const toolbar = page.getByTestId("toolbar-visual-fixture");
  const toolbarControl = toolbar.locator(":scope > div.absolute");

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

  await toolbarControl.hover();
  await expect(toolbarControl.locator("svg")).toHaveCount(2);
  await toolbarControl.locator("svg").last().hover();
  await expect(page.getByRole("tooltip", { name: "Add comments" })).toBeVisible();
  await expect(fixture).toHaveScreenshot("artifact-toolbar-expanded.png");
});
