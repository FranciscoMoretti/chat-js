import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import { z } from "zod";

import { textPdf } from "./eve-attachment-fixtures";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
// Exercise the native PDF viewer rather than Chromium's headless shell.
test.use({ channel: "chromium" });
const blobUrl = /^blob:/u;
const chatUrl = /\/chat\/[a-f0-9-]+$/u;

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
