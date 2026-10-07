/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { execFileSync } from "node:child_process";; its Node runtime boundary deliberately permits these built-ins.
 */
import { execFileSync } from "node:child_process";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { textPdf } from "./eve-attachment-fixtures";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */
// Exercise the native PDF viewer rather than Chromium's headless shell.
test.use({ channel: "chromium" });
const blobUrl = /^blob:/u;
const chatUrl = /\/chat\/[a-f0-9-]+$/u;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("a PDF uploaded through the composer reaches the model and opens after reload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("a PDF uploaded through the composer reaches the model and opens after reload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a PDF uploaded through the composer reaches the model and opens after reload") uses 240_000, 2, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * node/no-sync (#538): test("a PDF uploaded through the composer reaches the model and opens after reload") uses execFileSync("bun", [ "-e", 'import { deleteFilesByUrls } from "./lib/file-storage";  within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/prefer-readonly-parameter-types (#565): test("a PDF uploaded through the composer reaches the model and opens after reload") accepts { page, }; route; response; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("a PDF uploaded through the composer reaches the model and opens after reload") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("a PDF uploaded through the composer reaches the model and opens after reload", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-mini" },
  });
  await page.goto("/");
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/files/upload") &&
      response.request().method() === "POST"
  );
  await page
    .getByRole("group", { exact: true, name: "Message composer" })
    .getByLabel("Attach files", { exact: true })
    .setInputFiles({
      buffer: textPdf("Verification code: CEDAR-4827"),
      mimeType: "application/pdf",
      name: "verification.pdf",
    });
  const response = await uploaded;
  expect(response.ok()).toBe(true);
  const file = z.object({ url: z.string() }).parse(await response.json());
  try {
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill(
        "What is the verification code in the document? Reply with only the code."
      );
    await expect(
      page.getByRole("button", { exact: true, name: "Send" })
    ).toBeEnabled();
    await page
      .getByRole("group", { exact: true, name: "Message composer" })
      .screenshot({
        animations: "disabled",
        path: "tests/eve-results/screenshots/eve-composer-pdf.png",
      });
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page).toHaveURL(chatUrl, { timeout: 35_000 });
    await expect(page.locator(".is-assistant")).toContainText("CEDAR-4827", {
      timeout: 90_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const sourceUrl = page.url();
    const composer = page.getByRole("group", {
      exact: true,
      name: "Message composer",
    });
    await composer
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Repeat the document code.");
    await composer.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page.locator(".is-assistant")).toHaveCount(2, {
      timeout: 90_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .nth(1)
      .click();
    const editor = page.getByRole("dialog");
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill(
        "Read the earlier attached PDF and return its verification code only."
      );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page).not.toHaveURL(sourceUrl, { timeout: 60_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant").last()).toContainText(
      "CEDAR-4827"
    );
    await expect(page.locator(".is-user").last()).toContainText(
      "Read the earlier attached PDF"
    );
    await page.reload();
    await page
      .getByRole("log")
      .getByRole("button", { exact: true, name: "verification.pdf" })
      .hover();
    const opened = page.waitForEvent("popup");
    await page.getByTitle("Open", { exact: true }).click();
    const preview = await opened;
    await expect(preview).toHaveURL(blobUrl);
    await preview.close();
    await page.goto(sourceUrl);
    await expect(page.locator(".is-user").last()).toContainText(
      "Repeat the document code."
    );
    await expect(page.locator(".is-user")).toHaveCount(2);
  } finally {
    execFileSync("bun", [
      "-e",
      'import { deleteFilesByUrls } from "./lib/file-storage"; await deleteFilesByUrls([process.argv[1]]);',
      file.url,
    ]);
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
