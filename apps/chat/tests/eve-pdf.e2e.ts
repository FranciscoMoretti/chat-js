import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { textPdf } from "./eve-attachment-fixtures";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
// Exercise the native PDF viewer rather than Chromium's headless shell.
test.use({ channel: "chromium" });
const blobUrl = /^blob:/;
const chatUrl = /\/chat\/[a-f0-9-]+$/;

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
    .getByRole("group", { name: "Message composer", exact: true })
    .getByLabel("Attach files", { exact: true })
    .setInputFiles({
      name: "verification.pdf",
      mimeType: "application/pdf",
      buffer: textPdf("Verification code: CEDAR-4827"),
    });
  const response = await uploaded;
  expect(response.ok()).toBe(true);
  const file = z.object({ url: z.string() }).parse(await response.json());
  try {
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(
        "What is the verification code in the document? Reply with only the code."
      );
    await expect(
      page.getByRole("button", { name: "Send", exact: true })
    ).toBeEnabled();
    await page
      .getByRole("group", { name: "Message composer", exact: true })
      .screenshot({
        path: "tests/eve-results/screenshots/eve-composer-pdf.png",
        animations: "disabled",
      });
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page).toHaveURL(chatUrl, { timeout: 35_000 });
    await expect(page.locator(".is-assistant")).toContainText("CEDAR-4827", {
      timeout: 90_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const sourceUrl = page.url();
    const composer = page.getByRole("group", {
      name: "Message composer",
      exact: true,
    });
    await composer
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Repeat the document code.");
    await composer.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator(".is-assistant")).toHaveCount(2, {
      timeout: 90_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await page
      .getByRole("button", { name: "Edit message", exact: true })
      .nth(1)
      .click();
    const editor = page.getByRole("dialog");
    await editor
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(
        "Read the earlier attached PDF and return its verification code only."
      );
    await editor.getByRole("button", { name: "Send", exact: true }).click();
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
      .getByRole("button", { name: "verification.pdf", exact: true })
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
