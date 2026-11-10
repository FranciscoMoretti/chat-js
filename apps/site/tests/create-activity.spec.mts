import { commandAppPreset, selectPreviewTools } from "./create-fixtures.mts";
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
for (const base of ["base"] as const) {
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
      await selectPreviewTools(page);
      await expect(
        page.getByRole("button", { name: "Show all sources", exact: true })
      ).toBeVisible();
      await page.goto(
        `/create/preview?item=preview-02&base=${base}&preset=${preset}`
      );
      const copy = page.getByRole("button", { name: "Copy Code", exact: true });
      await copy.click();
      expect(
        await page.evaluate(async () => {
          const text = await navigator.clipboard.readText();
          return text.trim();
        })
      ).toBe("bunx chat-js@alpha create my-chat");
    }
    expect(errors).toEqual([]);
  });
}

for (const base of ["base"] as const) {
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
        await selectPreviewTools(page);
        await expect(
          page.getByText(
            "Sample results for your selected tools. No external services are called.",
            { exact: true }
          )
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

test("unsupported library links offer a Base UI recovery without losing selections", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.goto("/create?base=aria&preset=b27I2r8C&uploads=true");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "This setup is not available yet." })
  ).toContainText("This preview uses Next.js and Base UI.");
  await page.getByRole("button", { name: "Use Base UI and Next.js" }).click();
  await expect(
    page.frameLocator("iframe").getByTestId("chat-preview")
  ).toHaveAttribute("data-base", "base");
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("create-command")).toContainText("--base base");
  await expect(page.getByTestId("create-command")).toContainText(
    "--preset b27I2r8C"
  );
  expect(
    commandAppPreset(await page.getByTestId("create-command").textContent())
      .sandbox
  ).toBe("vercel");
});
