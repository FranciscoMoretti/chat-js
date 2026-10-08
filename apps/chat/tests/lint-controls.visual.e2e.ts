import { expect, test } from "@playwright/test";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements --
 * max-statements (#512): test("composer addons preserve focus and nested button actions") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.goto(), locator.click(), locator.fill() on the original Page/locator receiver to change the live browser or route state.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
