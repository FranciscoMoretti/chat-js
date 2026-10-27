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

test("guest welcome accepts a draft with a locked model picker", async ({
  page,
}) => {
  const message = page.getByRole("textbox", { exact: true, name: "Message" });
  await message.fill("Guest draft");
  await expect(message).toHaveText("Guest draft");
  await expect(
    page.getByRole("button", { exact: true, name: "Send" })
  ).toBeEnabled();
});

test("guest errors preserve the message draft", async ({ page }) => {
  const fixture = page.getByTestId("guest-visual");
  await fixture
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Preserve this draft");
  await fixture.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(fixture.getByRole("alert")).toBeVisible();
  await expect(
    fixture.getByRole("textbox", { exact: true, name: "Message" })
  ).toHaveText("Preserve this draft");
});

test("guest response", async ({ page }) => {
  const fixture = page.getByTestId("guest-visual");
  await page.getByLabel("Fixture state").selectOption("response");
  await expect(
    fixture.getByText("A useful test protects", { exact: false })
  ).toBeVisible();
});

test("expired guest on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByLabel("Fixture state").selectOption("expired");
  await expect(
    page.getByText("This chat has expired. Start a new chat to continue.", {
      exact: false,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Send" })
  ).toBeDisabled();
});

test("guest welcome accepts a draft on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const message = page.getByRole("textbox", { exact: true, name: "Message" });
  await message.fill("Mobile guest draft");
  await expect(message).toHaveText("Mobile guest draft");
  await expect(
    page.getByRole("button", { exact: true, name: "Send" })
  ).toBeEnabled();
});
