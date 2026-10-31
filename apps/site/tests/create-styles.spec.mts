/* eslint-disable no-await-in-loop -- Appearance changes must settle in the same open menu. */
import { test, expect } from "@uiverify/playwright";
import {
  DEFAULT_PRESET_CONFIG,
  encodePreset,
  PRESET_STYLES,
  PRESET_MENU_COLORS,
} from "shadcn/preset";

// Exercise every layout combination. Capture two representative layouts per
// style/library, with menus and tool states together to avoid redundant shots.
for (const base of ["base", "radix"] as const) {
  for (const [index, style] of PRESET_STYLES.entries()) {
    for (const rtl of [false, true]) {
      for (const width of [1000, 390]) {
        test(`${base} ${style} ${rtl ? "rtl" : "ltr"} ${width}`, async ({
          page,
          uiVerify,
        }) => {
          uiVerify.disableAutoSnapshot();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          const menuColor =
            PRESET_MENU_COLORS[index % PRESET_MENU_COLORS.length];
          const preset = encodePreset({
            ...DEFAULT_PRESET_CONFIG,
            style,
            menuColor,
          });
          await page.setViewportSize({ width, height: 1000 });
          await page.emulateMedia({
            colorScheme: width === 390 ? "dark" : "light",
          });
          await page.goto(
            `/create/preview?base=${base}&preset=${preset}&rtl=${rtl}&item=preview-tools`
          );
          await expect(page.getByTestId("chat-preview")).toHaveAttribute(
            "data-style",
            style
          );
          await expect(page.locator("html")).toHaveAttribute(
            "dir",
            rtl ? "rtl" : "ltr"
          );
          const failed = page.getByRole("button", {
            name: "Search unavailable Error",
          });
          await expect(failed).toHaveAttribute("aria-expanded", "true");
          await failed.press("Enter");
          await expect(failed).toHaveAttribute("aria-expanded", "false");
          await failed.press("Enter");
          await page.evaluate(async () => await document.fonts.ready);
          await page.addStyleTag({
            content:
              "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }",
          });
          const scenario = page.getByRole("button", {
            name: "Preview scenario",
          });
          await scenario.click();
          await expect(
            page.getByRole("menuitemradio", {
              name: "Tool states",
              exact: true,
            })
          ).toBeVisible();
          if (rtl === (width === 390)) {
            await uiVerify.snapshot("tools and menu");
          }
          await page
            .getByRole("menuitemradio", { name: "New chat", exact: true })
            .click();
          await expect(
            page.getByRole("heading", { name: "How can I help you today?" })
          ).toBeVisible();
          const model = page.getByRole("button", {
            name: "Choose preview model",
          });
          await model.click();
          await page
            .getByRole("menuitemradio", { name: "Fast", exact: true })
            .click();
          await expect(model).toContainText("Fast");
          await scenario.click();
          await page
            .getByRole("menuitemradio", { name: "Conversation", exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: "Copy", exact: true })
          ).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth
            )
          ).toBe(true);
          expect(errors).toEqual([]);
        });
      }
    }
  }
}

for (const base of ["base", "radix"] as const) {
  test(`${base} keeps the open menu and draft while the native provider changes appearance`, async ({
    page,
    uiVerify,
  }) => {
    uiVerify.disableAutoSnapshot();
    await page.goto(`/create?base=${base}`);
    const frame = page.frameLocator("iframe");
    // Radix modal menus hide background controls from the accessibility tree.
    const draft = frame.locator('[contenteditable][aria-label="Message"]');
    await draft.fill("Keep my draft while changing the preset");
    await frame.getByRole("button", { name: "Choose preview model" }).click();
    const popup = frame.locator('[data-slot="dropdown-menu-content"]');
    await expect(popup).toBeVisible();
    const originalMenu = await popup.elementHandle();
    for (const [index, menuColor] of PRESET_MENU_COLORS.entries()) {
      const style = PRESET_STYLES[index];
      await page.evaluate(
        (appearance) => {
          document.querySelector("iframe")?.contentWindow?.postMessage(
            {
              type: "design-system-params",
              data: appearance,
            },
            window.location.origin
          );
        },
        { style, menuColor, font: "inter" }
      );
      await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
        "data-style",
        style
      );
      await expect(popup).toBeVisible();
      expect(
        await originalMenu?.evaluate((element) => element.isConnected)
      ).toBe(true);
      await expect
        .poll(
          async () =>
            await popup.evaluate((element) => ({
              inverted: element.classList.contains("dark"),
              translucent: element.classList.contains("cn-menu-translucent"),
            }))
        )
        .toEqual({
          inverted: menuColor.startsWith("inverted"),
          translucent: menuColor.endsWith("translucent"),
        });
      await expect(draft).toHaveText("Keep my draft while changing the preset");
      // Portaled menus and upstream @apply utilities must use the preset font,
      // even when the host site's theme defines a different inline font alias.
      await expect(popup).toHaveCSS("font-family", /inter/iu);
      await expect(frame.locator('[data-slot="code-block-title"]')).toHaveCSS(
        "font-family",
        /inter/iu
      );
    }
    await frame
      .getByRole("menuitemradio", { name: "Fast", exact: true })
      .click();
    await expect(
      frame.getByRole("button", { name: "Choose preview model" })
    ).toContainText("Fast");
  });
}
