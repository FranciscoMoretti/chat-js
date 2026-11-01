import { presentationFonts } from "./presentation-fonts";
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

test("EVE message presentation keeps editing, actions, versions and cards coherent", async ({
  page,
}, testInfo: Readonly<Pick<TestInfo, "outputPath">>) => {
  const errors: string[] = [];
  page.on("pageerror", (error: Readonly<Error>) => errors.push(error.message));
  const script = execFileSync(
    "bun",
    ["tests/eve-message-presentation.build.mjs"],
    {
      encoding: "utf-8",
      maxBuffer: 30 * 1024 * 1024,
    }
  );
  const css = execFileSync(
    "bun",
    [
      "-e",
      'import postcss from "postcss";import tailwind from "@tailwindcss/postcss";const from=process.cwd()+"/app/globals.css";const result=await postcss([tailwind()]).process(await Bun.file(from).text(),{from});process.stdout.write(result.css);',
    ],
    { encoding: "utf-8", maxBuffer: 30 * 1024 * 1024 }
  );
  const fixtureUrl = "http://eve-message-presentation.test/";
  await page.route("**/*", async (route) => {
    if (route.request().url() === fixtureUrl) {
      await route.fulfill({
        body: `<!doctype html><html class="dark"><head><style>${css} ${presentationFonts}</style></head><body class="bg-background text-foreground"><div id="root"></div></body></html>`,
        contentType: "text/html",
      });
      return;
    }
    await route.abort();
  });
  await page.goto(fixtureUrl);
  await page.addScriptTag({ content: script, type: "module" });
  await page.evaluate(async () => {
    await document.fonts.load('16px "Geist"');
    await document.fonts.ready;
    if (!document.fonts.check('16px "Geist"')) {
      throw new Error("Presentation font failed to load");
    }
  });

  const editable = page.getByTestId("editable-transcript").first();
  const firstUser = editable.locator('[data-message-id="user-1"]');
  const firstAssistant = editable.locator('[data-message-id="assistant-1"]');
  const secondAssistant = editable.locator('[data-message-id="assistant-2"]');
  const readonly = page.getByTestId("readonly-transcript");
  await expect(
    firstUser.locator('[data-slot="bubble"][data-variant="muted"]')
  ).toBeVisible();
  await expect(
    firstAssistant.locator('[data-slot="message"][data-align="start"]')
  ).toBeVisible();
  await expect(
    firstUser.getByRole("button", { name: "Previous version" })
  ).toBeEnabled();
  await expect(
    firstUser.getByRole("button", { name: "Next version" })
  ).toBeEnabled();
  await expect(
    editable
      .locator('[data-message-id="user-2"]')
      .getByRole("button", { name: "Next version" })
  ).toBeDisabled();
  await expect(
    firstAssistant.getByRole("button", { name: "Regenerate response" })
  ).toBeVisible();
  await expect(firstAssistant.getByText("model-a")).toBeVisible();
  await expect(
    firstUser.getByTestId("inline-response-cards").getByRole("button")
  ).toHaveCount(2);

  // Selecting text must not accidentally enter edit mode.
  await page.evaluate(() => {
    const node = document.querySelector(
      '[data-testid="editable-transcript"] [data-message-id="user-1"] pre'
    );
    if (!node?.firstChild) {
      throw new Error("Missing message text");
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = globalThis.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    node.closest("button")?.click();
  });
  await expect(editable.getByTestId("inline-editor")).toHaveCount(0);
  await page.evaluate(() => globalThis.getSelection()?.removeAllRanges());
  await firstUser.locator('button[data-testid="message-content"]').click();
  await expect(editable.getByTestId("inline-editor")).toBeVisible();
  await expect(
    firstUser.getByRole("button", { exact: true, name: "Cancel edit" })
  ).toBeVisible();
  await firstUser.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("message-presentation-edit.png"),
  });
  await firstUser
    .getByRole("button", { exact: true, name: "Cancel edit" })
    .click();
  await expect(editable.getByTestId("inline-editor")).toHaveCount(0);
  await expect(page.getByTestId("interaction-log")).toContainText(
    "edit:user-1"
  );
  await secondAssistant
    .getByRole("button", { name: "Regenerate response" })
    .click();
  await expect(page.getByTestId("interaction-log")).toContainText(
    "retry:user-2->assistant-2"
  );
  await firstUser.getByRole("button", { name: "Next version" }).click();
  await expect(page.getByTestId("interaction-log")).toContainText(
    "next:user-1"
  );
  await expect(
    readonly.locator('button[data-testid="message-content"]')
  ).toHaveCount(0);
  await expect(
    readonly.getByRole("button", { name: "Edit message" })
  ).toHaveCount(0);
  await expect(
    readonly.getByRole("button", { exact: true, name: "Copy" })
  ).toHaveCount(4);
  await expect(
    page
      .getByTestId("editable-transcript")
      .nth(1)
      .locator('[data-message-id="assistant-2"] button')
  ).toHaveCount(0);
  await expect(
    page.getByTestId("comparison-cards").getByRole("button")
  ).toHaveCount(2);
  await page
    .getByTestId("comparison-cards")
    .getByRole("button", { name: "Model B Generating..." })
    .click();

  await page.setViewportSize({ height: 1100, width: 1280 });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("message-presentation-desktop.png"),
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(
    firstUser.getByRole("button", { name: "Edit message" })
  ).toHaveCSS("opacity", "1");
  await expect(
    firstUser.getByRole("button", { exact: true, name: "Copy" })
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("message-presentation-mobile.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  expect(errors).toEqual([]);
});
