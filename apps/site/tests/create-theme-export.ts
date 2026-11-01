import { expect } from "playwright/test";
import type { Page } from "playwright/test";
import { DEFAULT_PRESET_CONFIG, encodePreset } from "shadcn/preset";

export const checkCreateThemeExport = async (page: Page, origin: string) => {
  const preset = encodePreset({
    ...DEFAULT_PRESET_CONFIG,
    style: "rhea",
    radius: "large",
  });
  await page.goto(`${origin}/create?preset=${preset}`, {
    waitUntil: "domcontentloaded",
  });
  const preview = page.frameLocator("iframe");
  await expect(preview.getByTestId("chat-preview")).toHaveAttribute(
    "data-preset",
    encodePreset({ ...DEFAULT_PRESET_CONFIG, style: "rhea", radius: "default" })
  );
  const radius = await preview
    .locator("html")
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--radius").trim()
    );
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Create your ChatJS app" });
  await dialog.getByRole("button", { name: "Theme", exact: true }).click();
  await expect(dialog.locator("pre")).toContainText(`--radius: ${radius};`);
  await dialog.getByRole("button", { name: "Copy Theme", exact: true }).click();
  const css = await page.evaluate(
    async () => await navigator.clipboard.readText()
  );
  expect(css).toContain(`--radius: ${radius};`);
};
