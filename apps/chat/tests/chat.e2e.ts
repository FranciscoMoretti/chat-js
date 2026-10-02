import { expect, test } from "@playwright/test";

test("chat page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("textbox")).toBeVisible();
});

test("development login tool is available on the login page", async ({
  page,
}) => {
  await page.goto("/login");

  const devLogin = page.getByRole("link", { name: "Dev login" });
  await expect(devLogin).toBeVisible();
  await expect(devLogin).toHaveAttribute("href", "/api/dev-login");
});

test("connector settings hydrate consistently across page boundaries", async ({
  page,
}, testInfo) => {
  const hydrationErrors: string[] = [];
  const recordHydrationError = (message: string) => {
    if (/hydration|server rendered HTML/iu.test(message)) {
      hydrationErrors.push(message);
    }
  };
  page.on("pageerror", (error) => recordHydrationError(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      recordHydrationError(message.text());
    }
  });

  await page.request.get("/api/dev-login", { maxRedirects: 0 });
  await page.goto("/settings/connectors");
  await page.getByRole("button", { name: "Add custom connector" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await testInfo.attach("connector-settings-hydrated", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL("/settings/connectors");
  await page.reload();
  await page.getByRole("button", { name: "Add custom connector" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.goto("/settings/connectors/hydration-regression-missing");
  await expect(
    page.getByText("Connector not found", { exact: true })
  ).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Back" }).click();
  await page.getByRole("button", { name: "Add custom connector" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});
