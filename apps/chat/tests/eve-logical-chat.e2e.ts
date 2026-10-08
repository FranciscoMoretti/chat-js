import { expect, test } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import required by consistent-type-imports; it has no runtime evaluation order.
import type { Response, TestInfo } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep Playwright type-only imports separate from runtime bindings; moving them has no runtime module-order effect.

const chatRoute = /\/chat\/[a-f\d-]+$/u;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async --
 * max-lines-per-function (#510): test("logical chat keeps its URL and native observers across first send, retry, edit  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("logical chat keeps its URL and native observers across first send, retry, edit  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("logical chat keeps its URL and native observers across first send, retry, edit  uses 240_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("logical chat keeps its URL and native observers across first send, retry, edit  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.route(), page.goto(), page.on() on the original Page/locator receiver to change the live browser or route state.
test("logical chat keeps its URL and native observers across first send, retry, edit and reload", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  test.setTimeout(240_000);
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-nano" },
  });
  await page.goto("/");
  const errors: string[] = [];
  page.on("pageerror", (error: Readonly<Error>) => errors.push(error.message));
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
    (response: Readonly<Pick<Response, "request" | "url">>) =>
      response.url().endsWith("/api/agent-conversations") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { exact: true, name: "Retry" }).last().click();
  const acceptedRetryResponse = await retryAccepted;
  expect(acceptedRetryResponse.ok()).toBe(true);
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
    (response: Readonly<Pick<Response, "request" | "url">>) =>
      response.url().endsWith("/api/agent-conversations") &&
      response.request().method() === "POST"
  );
  await editor.getByRole("button", { exact: true, name: "Send" }).click();
  const acceptedEditResponse = await editAccepted;
  expect(acceptedEditResponse.ok()).toBe(true);
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async */
