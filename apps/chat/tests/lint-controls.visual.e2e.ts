import { expect, test } from "@playwright/test";

/* oxlint-disable max-statements, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("composer addons preserve focus and nested button actions") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): test("composer addons preserve focus and nested button actions") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("composer addons preserve focus and nested button actions") accepts { page, }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("composer addons preserve focus and nested button actions", async ({
  page,
}) => {
  await page.goto("/visual-fixtures/lint-controls");
  const fixture = page.getByTestId("lint-controls-fixture");
  const message = page.getByRole("textbox", { name: "Message" });
  await page.getByText("Focus message", { exact: true }).click();
  await expect(message).toBeFocused();
  await message.fill("Keyboard-accessible composer");
  const action = page.getByRole("button", { name: "Attachment action" });
  await action.click();
  await expect(action).toBeFocused();
  await expect(page.getByText("Actions: 1", { exact: true })).toBeVisible();
  await action.press("Enter");
  await expect(page.getByText("Actions: 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Saving" })).toBeVisible();
  await page.getByRole("button", { name: "Change shimmer element" }).click();
  await expect(
    fixture.locator("p").filter({ hasText: "Thinking..." })
  ).toBeVisible();
  await expect(fixture).toHaveScreenshot("lint-controls.png", {
    animations: "disabled",
    stylePath: "tests/lint-controls.visual.css",
  });
  await test.info().attach("lint-controls", {
    body: await fixture.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
});
/* oxlint-enable max-statements, oxc/no-async-await, typescript/prefer-readonly-parameter-types */
