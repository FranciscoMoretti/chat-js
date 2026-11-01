import { expect } from "playwright/test";
import type { Page } from "playwright/test";

// A shared link is the session's starting point, not an undoable edit.
export const checkCreateHistory = async (page: Page, origin: string) => {
  const presetButton = page.locator('button[title^="--preset "]');
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  const pickTheme = async (name: string) => {
    await page.getByRole("button", { name: /^Theme /u }).click();
    const option = page.getByRole("menuitemradio", { name, exact: true });
    await option.click();
    await option.press("Escape");
    await expect(
      page.getByRole("button", { name: `Theme ${name}`, exact: true })
    ).toBeVisible();
    await expect
      .poll(async () => {
        const title = await presetButton.getAttribute("title");
        const preset = title?.replace("--preset ", "");
        return new URL(page.url()).searchParams.get("preset") === preset;
      })
      .toBe(true);
  };
  await page.goto(`${origin}/create?preset=b4Xa52`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .waitFor();
  await expect(presetButton).toHaveAttribute("title", "--preset b4Xa52");
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await pickTheme("Blue");
  const blue = await presetButton.getAttribute("title");
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(presetButton).toHaveAttribute("title", "--preset b4Xa52");
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(presetButton).toHaveAttribute("title", blue ?? "");
  await expect(redo).toBeDisabled();
  await undo.click();
  // Edit immediately, without waiting for Undo's throttled URL write. The new
  // selection must replace the redo branch even when that acknowledgment loses.
  await pickTheme("Green");
  await expect(redo).toBeDisabled();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .waitFor();
  await expect(
    page.getByRole("button", { name: "Theme Green", exact: true })
  ).toBeVisible();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await pickTheme("Blue");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Theme Green", exact: true })
  ).toBeVisible();
  await page.goForward({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Theme Blue", exact: true })
  ).toBeVisible();
};
