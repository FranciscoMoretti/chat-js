/* oxlint-disable unicorn/no-await-expression-member -- Each response assertion is tied to its awaited browser action. */
import { expect, test } from "@playwright/test";

const chatRoute = /\/chat\/[a-f\d-]+$/u;

test("logical chat keeps its URL and native observers across first send, retry, edit and reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-nano" },
  });
  await page.goto("/");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const initialTime = await page.evaluate(() => performance.timeOrigin);
  const composer = page.getByRole("group", {
    exact: true,
    name: "Message composer",
  });
  const first = "Do not use tools. Reply with exactly amber.";
  await composer
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(first);
  await composer.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page.getByRole("log")).toContainText(first);
  await expect(page).toHaveURL(chatRoute);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const url = page.url();
  await expect(page.getByRole("log")).toContainText("amber");
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(initialTime);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("first-send.png"),
  });

  const second = "Do not use tools. Reply with exactly cobalt.";
  await composer
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(second);
  await composer.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page.getByRole("log")).toContainText(second);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(
    page.getByRole("button", { exact: true, name: "Retry" }).last()
  ).toBeEnabled();
  const retryAccepted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/agent-conversations") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { exact: true, name: "Retry" }).last().click();
  expect((await retryAccepted).ok()).toBe(true);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(
    page.getByRole("button", { exact: true, name: "Previous version" }).last()
  ).toBeEnabled();
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(initialTime);
  await page
    .getByRole("button", { exact: true, name: "Previous version" })
    .last()
    .click();
  await expect(page.getByRole("log")).toContainText(second);
  await page
    .getByRole("button", { exact: true, name: "Next version" })
    .last()
    .click();
  await expect(page.getByRole("log")).toContainText(second);

  await page
    .getByRole("button", { exact: true, name: "Edit message" })
    .last()
    .click();
  const editor = page
    .getByRole("log")
    .getByRole("group", { exact: true, name: "Message composer" });
  await editor
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Do not use tools. Reply with exactly jade.");
  const editAccepted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/agent-conversations") &&
      response.request().method() === "POST"
  );
  await editor.getByRole("button", { exact: true, name: "Send" }).click();
  expect((await editAccepted).ok()).toBe(true);
  await expect(page.getByRole("log")).toContainText("exactly jade");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  expect(page.url()).toBe(url);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("edited-branch.png"),
  });
  await page.reload();
  await expect(page.getByRole("log")).toContainText("exactly jade", {
    timeout: 90_000,
  });
  expect(page.url()).toBe(url);
  await expect(
    page.getByRole("button", { exact: true, name: "Previous version" }).first()
  ).toBeEnabled();
  await page
    .getByRole("button", { exact: true, name: "Previous version" })
    .first()
    .click();
  await expect(page.getByRole("log")).toContainText(second);
  expect(errors).toEqual([]);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("reloaded-tree.png"),
  });
});
