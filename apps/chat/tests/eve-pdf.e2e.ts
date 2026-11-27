import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import type { Response } from "@playwright/test";
import { z } from "zod";

import { textPdf } from "./eve-attachment-fixtures";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
// Exercise the native PDF viewer rather than Chromium's headless shell.
test.use({ channel: "chromium" });
const chatUrl = /\/chat\/[a-f0-9-]+$/u;

test("a PDF uploaded through the composer reaches the model and opens after reload", async ({
  page,
}) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(15_000);
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-mini" },
  });
  await page.goto("/");
  const uploaded = page.waitForResponse(
    (response: Readonly<Pick<Response, "request" | "url">>) =>
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
    await expect(
      page.locator('[data-eve-message-id][data-role="assistant"]')
    ).toContainText("CEDAR-4827", {
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
    await expect(
      page.locator('[data-eve-message-id][data-role="assistant"]')
    ).toHaveCount(2, {
      timeout: 90_000,
    });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await page
      .getByRole("button", {
        exact: true,
        name: "Edit message",
      })
      .nth(1)
      .click();
    const editor = page
      .getByRole("log")
      .getByRole("group", { name: "Message composer" });
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill(
        "Read the earlier attached PDF and return its verification code only."
      );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page).toHaveURL(sourceUrl);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page.locator('[data-eve-message-id][data-role="assistant"]').last()
    ).toContainText("CEDAR-4827");
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      "Read the earlier attached PDF"
    );
    await page.reload();
    const attachment = page
      .getByRole("log")
      .getByRole("button", { exact: true, name: "verification.pdf" });
    const open = page.getByTitle("Open", { exact: true });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(async () => {
      await page.mouse.move(0, 0);
      await attachment.hover();
      await expect(open).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 12_000 });
    const fileHref = new URL(file.url, page.url()).href;
    const opened = page.waitForEvent("popup");
    await open.click();
    const preview = await opened;
    const authResponse = await page.request.get(fileHref, { maxRedirects: 0 });
    const target = new URL(
      authResponse.headers().location ?? fileHref,
      fileHref
    );
    // Signed URLs can be minted separately. Match the provider and object, keeping signatures out of test output.
    await expect
      .poll(() => {
        const actual = new URL(preview.url());
        return (
          actual.origin === target.origin && actual.pathname === target.pathname
        );
      })
      .toBe(true);
    const document = await page.request.get(fileHref);
    expect(document.ok()).toBe(true);
    expect(document.headers()["content-type"]).toContain("application/pdf");
    expect(await document.body()).toEqual(
      textPdf("Verification code: CEDAR-4827")
    );
    await preview.close();
    const original = page
      .getByRole("log")
      .getByText("Repeat the document code.", { exact: true });
    if (!(await original.isVisible())) {
      await page
        .getByRole("log")
        .getByRole("button", { name: "Previous version", exact: true })
        .click();
    }
    await expect(original).toBeVisible();
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      "Repeat the document code."
    );
    await expect(page.locator('[data-role="user"]')).toHaveCount(2);
  } finally {
    expect
      .soft(
        () =>
          execFileSync(
            "bun",
            [
              "--no-env-file",
              "-e",
              'import { db } from "./lib/db/client"; import { deleteFilesByUrls } from "./lib/file-storage"; try { await deleteFilesByUrls([process.argv[1]]); } finally { await db.$client.end({ timeout: 5 }); }',
              file.url,
            ],
            { timeout: 30_000, killSignal: "SIGKILL" }
          ),
        "Delete the fixture PDF"
      )
      .not.toThrow();
  }
});
