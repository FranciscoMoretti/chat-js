import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("chat page loads", async ({ app, browser, screen }) => {
  await app.open("/");
  await expect(browser).toHaveURL("/");
  await expect(screen.getByRole("textbox")).toBeVisible();
});

test("development login tool is available on the login page", async ({
  app,
  screen,
}) => {
  await app.open("/login");
  const devLogin = screen.getByRole("link", {
    name: "Dev login",
    exact: false,
  });
  await expect(devLogin).toBeVisible();
  await expect(devLogin).toHaveAttribute("href", "/api/dev-login");
});
