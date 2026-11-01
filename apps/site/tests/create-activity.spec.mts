/* eslint-disable no-await-in-loop -- Preset changes must settle before the next interaction. */
import { test, expect } from "@uiverify/playwright";
import { checkCreateHistory } from "./create-history.mjs";
import {
  DEFAULT_PRESET_CONFIG,
  encodePreset,
  PRESET_STYLES,
  PRESET_ICON_LIBRARIES,
} from "shadcn/preset";

test("preset history replaces the redo branch", async ({ page, uiVerify }) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/create");
  await checkCreateHistory(page, new URL(page.url()).origin);
  await expect(
    page.getByRole("button", { name: "Redo", exact: true })
  ).toBeDisabled();
  await expect(
    page.frameLocator("iframe").getByTestId("chat-preview")
  ).toBeVisible();
  await expect(
    page.getByText("Loading preview…", { exact: true })
  ).toBeHidden();
  await page.evaluate(async () => await document.fonts.ready);
  await page.addStyleTag({
    content:
      "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }",
  });
  await page.screenshot({
    path: "apps/site/uiverify-screenshots/create-history-beta.png",
  });
  // Capture the affected host toolbar. Preview scenes have their own captures;
  // the archive renderer cannot replay this cross-document iframe.
  await page.setViewportSize({ width: 1440, height: 64 });
  await uiVerify.snapshot("new history branch");
});

// Real preview route, captured directly so every tool state remains visible in
// the archive. The existing Create suite covers its host/iframe handshake.
for (const base of ["base", "radix"] as const) {
  test(`native ${base} activity across styles and icon libraries`, async ({
    page,
    uiVerify,
  }) => {
    uiVerify.disableAutoSnapshot();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    await page.setViewportSize({ width: 1000, height: 1000 });
    const glyphs = new Set<string>();
    for (const [index, style] of PRESET_STYLES.entries()) {
      const iconLibrary =
        PRESET_ICON_LIBRARIES[index % PRESET_ICON_LIBRARIES.length];
      const preset = encodePreset({
        ...DEFAULT_PRESET_CONFIG,
        style,
        iconLibrary,
      });
      await page.goto(
        `/create/preview?base=${base}&preset=${preset}&item=preview-tools`
      );
      await expect(page.getByTestId("chat-preview")).toHaveAttribute(
        "data-style",
        style
      );
      const failed = page.getByRole("button", {
        name: "Search unavailable Error",
      });
      await expect(failed).toHaveAttribute("aria-expanded", "true");
      await expect(
        page.locator('[data-slot="code-block"][role="alert"]')
      ).toContainText("The service could not be reached.");
      await failed.press("Enter");
      await expect(
        page.locator('[data-slot="code-block"][role="alert"]')
      ).toBeHidden();
      await failed.press("Enter");
      await expect(
        page.locator('[data-slot="code-block"][role="alert"]')
      ).toBeVisible();
      await expect(failed).toBeFocused();
      await page.getByRole("button", { name: "Retry sample tool" }).click();
      await expect(
        page.getByText(
          "This is a sample error state. No external tool runs in the preview."
        )
      ).toBeVisible();
      await page.getByRole("button", { name: "Preview scenario" }).click();
      await page
        .getByRole("menuitemradio", { name: "Conversation", exact: true })
        .click();
      const copy = page.getByRole("button", { name: "Copy", exact: true });
      glyphs.add(await copy.locator("svg").innerHTML());
      await copy.click();
      await expect(
        page.getByRole("button", { name: "Copied", exact: true })
      ).toBeVisible();
      expect(
        await page.evaluate(async () => await navigator.clipboard.readText())
      ).toBe("bunx @chat-js/cli@beta create my-chat");
    }
    expect(glyphs.size).toBe(PRESET_ICON_LIBRARIES.length);
    expect(errors).toEqual([]);
  });
}

for (const base of ["base", "radix"] as const) {
  for (const mode of ["light", "dark"] as const) {
    for (const width of [1000, 390]) {
      test(`${base === "base" ? "native" : "radix"} tool scene ${width} ${mode}`, async ({
        page,
        uiVerify,
      }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ colorScheme: mode });
        await page.goto(
          `/create/preview?base=${base}&preset=b27I2r8C&item=preview-tools`
        );
        await expect(page.getByTestId("chat-preview")).toHaveAttribute(
          "data-mode",
          mode
        );
        await expect(
          page.locator('[data-slot="code-block"][role="alert"]')
        ).toBeVisible();
        await page.evaluate(async () => await document.fonts.ready);
        await page.addStyleTag({
          content:
            "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }",
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        ).toBe(true);
        await uiVerify.snapshot("tools");
        await page.screenshot({
          path: `apps/site/uiverify-screenshots/w9-${base}-tools-${width}-${mode}.png`,
        });
      });
    }
  }
}

test("uploads include a persistent sandbox in the installation command", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/create");
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Create your ChatJS app" });
  const command = dialog.getByTestId("create-command");
  await expect(command).not.toContainText("--sandbox-provider");
  await dialog.getByRole("switch", { name: "Attachment uploads" }).check();
  await expect(command).toContainText("--sandbox-provider vercel");
  await expect(dialog.getByText(/Includes Vercel Sandbox/u)).toBeVisible();
  await expect(page).toHaveURL(/uploads=true/u);
  await page.reload();
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await expect(command).toContainText("--sandbox-provider vercel");
  await page.evaluate(async () => await document.fonts.ready);
  // The host dialog is the changed surface. Cross-document preview scenes have
  // independent captures and cannot be replayed by the archive renderer.
  await page.addStyleTag({
    content:
      "iframe, nextjs-portal { visibility: hidden !important; } *, *::before, *::after { animation: none !important; transition: none !important; }",
  });
  await uiVerify.snapshot("desktop installation");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByText(/Includes Vercel Sandbox/u)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await uiVerify.snapshot("mobile installation");
  await dialog
    .getByRole("button", { name: "Copy Command", exact: true })
    .click();
  expect(
    await page.evaluate(async () => await navigator.clipboard.readText())
  ).toContain("--sandbox-provider vercel");
  await dialog.getByRole("switch", { name: "Attachment uploads" }).uncheck();
  await expect(command).not.toContainText("--sandbox-provider");
  expect(errors).toEqual([]);
});

test("library selection preserves the preset, uploads, and native command", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/create?preset=b27I2r8C&uploads=true");
  const frame = page.frameLocator("iframe");
  const preview = frame.getByTestId("chat-preview");
  await expect(preview).toHaveAttribute("data-base", "base");
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Create your ChatJS app" });
  await dialog.getByRole("radio", { name: "Radix UI", exact: true }).check();
  const command = dialog.getByTestId("create-command");
  await expect(command).toContainText("--base radix");
  await expect(command).toContainText("--preset b27I2r8C");
  await expect(command).toContainText("--sandbox-provider vercel");
  await expect(page).toHaveURL(/base=radix/u);
  await page.keyboard.press("Escape");
  await expect(preview).toHaveAttribute("data-base", "radix");
  await frame.getByRole("button", { name: "Preview scenario" }).click();
  await frame
    .getByRole("menuitemradio", { name: "New chat", exact: true })
    .click();
  await expect(
    frame.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await frame.getByRole("button", { name: "Choose preview model" }).click();
  await frame.getByRole("menuitemradio", { name: "Fast", exact: true }).click();
  await expect(
    frame.getByRole("button", { name: "Choose preview model" })
  ).toContainText("Fast");
  await page.reload();
  await expect(preview).toHaveAttribute("data-base", "radix");
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await expect(command).toContainText("--base radix");
  await dialog.getByRole("radio", { name: "Base UI", exact: true }).check();
  await expect(command).toContainText("--base base");
  await page.keyboard.press("Escape");
  await expect(preview).toHaveAttribute("data-base", "base");
  expect(errors).toEqual([]);
});
