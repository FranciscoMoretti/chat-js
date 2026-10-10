import { expect, test } from "@playwright/test";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, typescript/promise-function-async --
 * max-lines-per-function (#510): test("disposable guest presentation uses stable desktop and mobile baselines") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("disposable guest presentation uses stable desktop and mobile baselines") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/promise-function-async (#606): test("disposable guest presentation uses stable desktop and mobile baselines") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.route(), page.goto(), page.addStyleTag() on the original Page/locator receiver to change the live browser or route state.
test("disposable guest presentation uses stable desktop and mobile baselines", async ({
  page,
}) => {
  await page.route(
    "**/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fulfill() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.fulfill({ body: "", contentType: "text/javascript" })
  );
  await page.route(
    "**/api/eve-guest",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fulfill() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.fulfill({ json: { error: "Unavailable" }, status: 502 })
  );
  await page.route(
    "https://models.dev/logos/openai.svg",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fulfill() to resolve the intercepted live request through the original native Route receiver.
    (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        path: "tests/fixtures/models/openai.svg",
      })
  );
  await page.goto("/visual-fixtures/disposable-guest");
  await page.addStyleTag({
    content:
      'nextjs-portal, [aria-label="Open Tanstack query devtools"] {display:none !important}',
  });
  const fixture = page.getByTestId("guest-visual");
  await expect(fixture.getByRole("heading")).toBeVisible();
  await expect(
    fixture.getByRole("textbox", { exact: true, name: "Message" })
  ).toBeVisible();
  await fixture
    .getByRole("img", { name: "openai logo" })
    .evaluate<unknown, HTMLImageElement>(
      async (image: Readonly<Pick<HTMLImageElement, "decode">>) => {
        await image.decode();
      }
    );
  await expect(fixture).toHaveScreenshot("guest-welcome.png");
  await fixture.getByRole("button", { name: /Guest fixture model/u }).click();
  await expect(
    page.getByRole("combobox").filter({ hasNot: page.locator("option") })
  ).toBeVisible();
  const clip = await fixture.boundingBox();
  if (!clip) {
    throw new Error("Guest fixture has no visible bounds");
  }
  await expect(page).toHaveScreenshot("guest-picker.png", { clip });
  await page.keyboard.press("Escape");
  await fixture
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Preserve this draft");
  await fixture.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(fixture.getByRole("alert")).toBeVisible();
  await expect(fixture).toHaveScreenshot("guest-error.png");
  await page.getByLabel("Fixture state").selectOption("response");
  await expect(
    fixture.getByText("A useful test protects", { exact: false })
  ).toBeVisible();
  await expect(fixture).toHaveScreenshot("guest-response.png");
  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByLabel("Fixture state").selectOption("expired");
  await expect(fixture).toHaveScreenshot("guest-expired-mobile.png");
  await page.getByLabel("Fixture state").selectOption("welcome");
  await expect(fixture.getByRole("heading")).toBeVisible();
  await expect(fixture).toHaveScreenshot("guest-welcome-mobile.png");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/promise-function-async */
