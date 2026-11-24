import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("model selector opens and closes", async ({ app, browser, screen }) => {
  await app.open("/visual-fixtures/model-toolbar");

  // Next's cached route tree can retain a hidden copy of this fixture.
  const fixture = browser.locator(
    '[data-testid="model-toolbar-fixture"]:visible'
  );
  const selector = fixture.getByTestId("model-selector");
  const search = screen.getByPlaceholder("Search models...");

  await expect(fixture).toBeVisible();
  await expect(selector).toHaveText("Primary fixture model");

  await selector.click();
  await expect(search).toBeVisible();
  await expect(screen.getByText("Reasoning fixture model")).toBeVisible();

  await selector.click();
  await expect(search).toBeHidden();
});
