import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/react-scan/**", async (route) => {
    await route.fulfill({ body: "", contentType: "text/javascript" });
  });
  await page.route("**/api/eve-guest", async (route) => {
    await route.fulfill({ json: { error: "Unavailable" }, status: 502 });
  });
  await page.route("https://models.dev/logos/openai.svg", async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      path: "tests/fixtures/models/openai.svg",
    });
  });
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
  await expect(
    fixture.getByRole("button", { name: /Guest fixture model/u })
  ).toBeDisabled();
});

test("guest welcome locks the model picker", async ({ page }) => {
  await expect(page.getByTestId("guest-visual")).toHaveScreenshot(
    "guest-welcome.png"
  );
});

test("guest errors preserve the message draft", async ({ page }) => {
  const fixture = page.getByTestId("guest-visual");
  await fixture
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Preserve this draft");
  await fixture.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(fixture.getByRole("alert")).toBeVisible();
  await expect(fixture).toHaveScreenshot("guest-error.png");
});

test("guest response", async ({ page }) => {
  const fixture = page.getByTestId("guest-visual");
  await page.getByLabel("Fixture state").selectOption("response");
  await expect(
    fixture.getByText("A useful test protects", { exact: false })
  ).toBeVisible();
  await expect(fixture).toHaveScreenshot("guest-response.png");
});

test("expired guest on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByLabel("Fixture state").selectOption("expired");
  await expect(page.getByTestId("guest-visual")).toHaveScreenshot(
    "guest-expired-mobile.png"
  );
});

test("guest welcome on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(page.getByTestId("guest-visual")).toHaveScreenshot(
    "guest-welcome-mobile.png"
  );
});
