/* eslint-disable no-await-in-loop -- Each native picker interaction must settle before the next. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import { iconLibraries } from "shadcn/icons";
import { verifyPreviewRecovery } from "./create-recovery";
import { checkCreateHistory } from "./create-history.mjs";
import { checkCreateThemeExport } from "./create-theme-export";
import {
  decodePreset,
  encodePreset,
  PRESET_STYLES,
  PRESET_ICON_LIBRARIES,
} from "shadcn/preset";

const output = fileURLToPath(
  new URL("../uiverify-screenshots/", import.meta.url)
);
await mkdir(output, { recursive: true });
const origin =
  process.env.CREATE_BASE_URL ??
  `http://localhost:${process.env.PORT ?? "3172"}`;
const browser = await chromium.launch();
const errors: string[] = [];
try {
  const page = await browser.newPage({
    storageState: process.env.CREATE_STORAGE_STATE,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    colorScheme: "light",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.goto(`${origin}/create`, {
    waitUntil: "domcontentloaded",
  });
  const frame = page.frameLocator("iframe");
  const code = async () => {
    const text = await page
      .getByRole("button", { name: /^--preset /u })
      .textContent();
    return (text ?? "").replace("--preset ", "").trim();
  };
  const waitForPreset = async (expectedCode?: string) => {
    let lastState = "";
    // Poll a fresh, atomic DOM snapshot: nuqs commits URL state asynchronously.
    // Capturing a host code once can wait forever for a superseded transition.
    try {
      await expect
        .poll(
          async () => {
            const state = await page.evaluate(() => {
              const title =
                document
                  .querySelector('button[title^="--preset "]')
                  ?.getAttribute("title") ?? "";
              return {
                host: title.replace("--preset ", ""),
                url: new URLSearchParams(location.search).get("preset") ?? "b0",
                preview: document
                  .querySelector("iframe")
                  ?.contentDocument?.querySelector<HTMLElement>(
                    '[data-testid="chat-preview"]'
                  )?.dataset.preset,
              };
            });
            lastState = JSON.stringify({
              ...state,
              hostDecoded: decodePreset(state.host),
              previewDecoded:
                state.preview !== undefined && state.preview.length > 0
                  ? decodePreset(state.preview)
                  : null,
            });
            if (
              !state.host ||
              state.host !== state.url ||
              (expectedCode !== undefined && state.host !== expectedCode)
            ) {
              return false;
            }
            const preset = decodePreset(state.host);
            if (!preset) {
              return false;
            }
            // Native provider fixes these radii only inside the preview.
            if (preset.style === "lyra" || preset.style === "sera") {
              preset.radius = "none";
            } else if (preset.style === "rhea" && preset.radius === "large") {
              preset.radius = "default";
            }
            return state.preview === encodePreset(preset);
          },
          {
            timeout: 60_000,
            message:
              "Committed native host and canonical preview presets settle",
          }
        )
        .toBe(true);
    } catch (error) {
      throw new Error(`Preset synchronization failed: ${lastState}`, {
        cause: error,
      });
    }
    await frame.locator("body").evaluate(async () => {
      await document.fonts.ready;
    });
  };
  const pick = async (label: string, value: string) => {
    console.log(`Checking ${label}: ${value}`);
    await page
      .getByRole("button", { name: new RegExp(`^${label} `, "u") })
      .click();
    const choice = page.getByRole("menuitemradio", {
      name: value,
      exact: true,
    });
    await choice.click();
    await expect(choice).toHaveAttribute("aria-checked", "true");
    await choice.press("Escape");
    await choice.waitFor({ state: "hidden" });
    await waitForPreset();
  };
  const capture = async (name: string) => {
    await page.screenshot({
      path: `${output}${name}.png`,
      animations: "disabled",
      style: "nextjs-portal { visibility: hidden !important; }",
    });
  };
  await waitForPreset();
  await capture("create-default");
  assert.notEqual(
    await frame
      .locator(
        '[data-slot="message"][data-align="end"] [data-slot="bubble-content"]'
      )
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgba(0, 0, 0, 0)"
  );

  const shapes = new Set<string>();
  for (const style of PRESET_STYLES) {
    await pick("Style", style[0].toUpperCase() + style.slice(1));
    shapes.add(
      (await frame
        .locator('[data-slot="input-group"]')
        .getAttribute("class")) ?? ""
    );
  }
  assert.equal(
    shapes.size,
    PRESET_STYLES.length,
    "All native styles change the actual component source"
  );
  const nativeGlyphs = new Set<string>();
  const appGlyphs = new Set<string>();
  for (const library of PRESET_ICON_LIBRARIES) {
    await pick("Icon Library", iconLibraries[library].title);
    appGlyphs.add(
      await frame
        .getByRole("button", { name: "Send preview message" })
        .locator("svg")
        .innerHTML()
    );
    await frame.getByRole("button", { name: "Choose preview model" }).click();
    nativeGlyphs.add(
      await frame
        .getByRole("menuitemradio", { name: "Balanced", exact: true })
        .locator("svg")
        .innerHTML()
    );
    await frame
      .getByRole("menuitemradio", { name: "Balanced", exact: true })
      .press("Escape");
    await frame
      .getByRole("menuitemradio", { name: "Balanced", exact: true })
      .waitFor({ state: "hidden" });
    await expect(
      frame.getByRole("button", { name: "Choose preview model" })
    ).toBeFocused();
  }
  assert.equal(nativeGlyphs.size, PRESET_ICON_LIBRARIES.length);
  assert.equal(
    appGlyphs.size,
    1,
    "Native init leaves app-owned Lucide glyphs unchanged"
  );
  await pick("Style", "Nova");
  await pick("Theme", "Rose");
  await pick("Font", "Inter");
  await pick("Heading", "Lora");
  await pick("Chart Color", "Blue");
  assert.equal(
    await frame
      .locator('[data-slot="input-group"]')
      .evaluate((el) => getComputedStyle(el).opacity),
    "1"
  );
  assert.match(
    await frame.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily),
    /lora/iu
  );

  const beforeShuffle = await code();
  const styleGroup = page
    .locator('[class*="group/picker"]')
    .filter({ has: page.getByRole("button", { name: /^Style /u }) });
  await styleGroup.getByRole("button", { name: "Lock", exact: true }).click();
  await page.getByRole("button", { name: "Shuffle", exact: true }).click();
  await page.waitForFunction(
    (previous) =>
      new URLSearchParams(location.search).get("preset") !== previous,
    beforeShuffle
  );
  await waitForPreset();
  assert.equal(
    decodePreset(await code())?.style,
    "nova",
    "Shuffle honors upstream locks"
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await waitForPreset(beforeShuffle);
  assert.equal(await code(), beforeShuffle, "Undo restores the native preset");
  await styleGroup.getByRole("button", { name: "Unlock", exact: true }).click();

  await page.getByRole("button", { name: "Open Preset", exact: true }).click();
  const presetDialog = page.getByRole("dialog", { name: "Open Preset" });
  await presetDialog.getByLabel("Preset code").fill("invalid");
  assert.equal(
    await presetDialog
      .getByRole("button", { name: "Open", exact: true })
      .isEnabled(),
    false
  );
  await presetDialog
    .getByLabel("Preset code")
    .fill(`--preset ${beforeShuffle}`);
  await presetDialog.getByRole("button", { name: "Open", exact: true }).click();
  await waitForPreset(beforeShuffle);

  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Create your ChatJS app" });
  await dialog.getByLabel("Model gateway").selectOption("openrouter");
  await dialog.getByRole("switch", { name: "Attachment uploads" }).check();
  await dialog.getByLabel("Storage provider").selectOption("s3");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Copy Command", exact: true })
      .isEnabled(),
    false
  );
  await dialog
    .getByLabel("Storage bucket", { exact: true })
    .fill("my-chat-uploads");
  await dialog.getByRole("switch", { name: "Pointer cursor" }).check();
  await dialog.getByRole("switch", { name: "Right-to-left" }).check();
  await page.waitForFunction(
    () => new URLSearchParams(location.search).get("rtl") === "true"
  );
  await dialog
    .getByRole("button", { name: "Copy Command", exact: true })
    .click();
  const command = await page.evaluate(
    async () => await navigator.clipboard.readText()
  );
  assert.match(command, /--gateway openrouter --attachments/u);
  assert.match(command, /--sandbox-provider vercel/u);
  await expect(dialog.getByText(/Includes Vercel Sandbox/u)).toBeVisible();
  assert.match(command, /--storage-config '\{"bucket":"my-chat-uploads"\}'/u);
  assert.match(command, /--rtl --pointer$/u);
  await capture("create-installation");
  await page.keyboard.press("Escape");
  await waitForPreset();
  await frame.getByRole("button", { name: "Attach sample file" }).click();
  await frame
    .getByRole("button", { name: "Remove sample attachment" })
    .waitFor();
  assert.equal(await frame.locator("html").getAttribute("dir"), "rtl");

  await page
    .getByRole("button", { name: "Menu Default / Solid", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Inverted", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Translucent", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await waitForPreset();
  await frame.getByRole("button", { name: "Choose preview model" }).click();
  await capture("create-custom-light-menu");
  await frame
    .getByRole("menuitemradio", { name: "Balanced", exact: true })
    .press("Escape");
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await frame.locator('[data-mode="dark"]').waitFor();
  await capture("create-custom-dark");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const share = await page.evaluate(
    async () => await navigator.clipboard.readText()
  );
  const sharedPreset = await code();
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await frame
    .getByRole("button", { name: "Search unavailable Error" })
    .waitFor();
  await frame.getByRole("button", { name: "Attach sample file" }).waitFor();
  await capture("create-tool-states");
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await frame
    .getByRole("heading", { name: "What can we build together?" })
    .waitFor();
  await frame.getByRole("button", { name: "Attach sample file" }).waitFor();
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await capture("create-empty-mobile");
  await frame
    .getByLabel("Preview message", { exact: true })
    .fill("Hello from my app");
  await frame.getByRole("button", { name: "Send preview message" }).click();
  await frame.getByText("Hello from my app", { exact: true }).waitFor();
  await frame.getByText(/This is a local preview/u).waitFor();

  await page.goto(share, { waitUntil: "domcontentloaded" });
  await waitForPreset(sharedPreset);
  assert.equal(await code(), sharedPreset);
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  assert.equal(
    await dialog.getByLabel("Storage bucket", { exact: true }).inputValue(),
    "my-chat-uploads"
  );
  await expect(dialog.getByTestId("create-command")).toContainText(
    "--sandbox-provider vercel"
  );
  await dialog.getByRole("switch", { name: "Attachment uploads" }).uncheck();
  await expect(dialog.getByTestId("create-command")).not.toContainText(
    "--sandbox-provider"
  );
  await dialog.getByRole("switch", { name: "Attachment uploads" }).check();
  await expect(dialog.getByTestId("create-command")).toContainText(
    "--sandbox-provider vercel"
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true,
    "No mobile horizontal overflow"
  );
  await capture("create-mobile");
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await dialog
    .getByRole("button", { name: "Copy Command", exact: true })
    .waitFor();
  await capture("create-mobile-installation");
  await page.keyboard.press("Escape");
  await page.goto(`${origin}/create?base=aria`);
  await page
    .getByRole("heading", { name: "This setup is not available yet." })
    .waitFor();
  await page.getByRole("button", { name: "Use Base UI and Next.js" }).click();
  await waitForPreset();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/create`);
  await waitForPreset("b0");
  const beforeHover = page.url();
  await page.getByRole("button", { name: /^Style /u }).click();
  await page.getByRole("menuitemradio", { name: "Mira", exact: true }).hover();
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-style",
    "mira"
  );
  assert.equal(
    page.url(),
    beforeHover,
    "Hover doesn't commit preset or history"
  );
  await page
    .getByRole("menuitemradio", { name: "Mira", exact: true })
    .press("Escape");
  await waitForPreset("b0");
  assert.equal(page.url(), beforeHover, "Escape restores the committed preset");

  const publicQuery = new URLSearchParams({
    token: "private",
    storage: "s3",
    "storage-config": JSON.stringify({ bucket: "public-bucket" }),
  });
  await page.goto(`${origin}/create?${publicQuery}`);
  await waitForPreset("b0");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const publicLink = new URL(
    await page.evaluate(async () => await navigator.clipboard.readText())
  );
  assert.equal(publicLink.searchParams.has("token"), false);
  assert.equal(
    publicLink.searchParams.get("storage-config"),
    JSON.stringify({ bucket: "public-bucket" })
  );
  publicQuery.set(
    "storage-config",
    JSON.stringify({ bucket: "public-bucket", secret: "private" })
  );
  await page.goto(`${origin}/create?${publicQuery}`);
  await expect(
    page.getByRole("button", { name: "Share", exact: true })
  ).toBeDisabled();

  await page.goto(`${origin}/create?preset=invalid`);
  await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
    "data-style",
    "nova"
  );
  assert.equal(
    await code(),
    "b0",
    "Invalid preset uses the upstream safe default"
  );
  await page.goto(`${origin}/create?template=vite`);
  await page
    .getByRole("heading", { name: "This setup is not available yet." })
    .waitFor();
  assert.equal(await page.locator("iframe").count(), 0);
  await page.getByRole("button", { name: "Use Base UI and Next.js" }).click();
  await waitForPreset();
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async () => {
        await Promise.resolve();
        throw new DOMException("denied", "NotAllowedError");
      },
    })
  );
  await page.getByRole("button", { name: /^--preset /u }).click();
  await page
    .getByText("Could not copy. Select the text and copy it manually.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Copied", exact: true }).count(),
    0
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await checkCreateHistory(page, origin);
  await checkCreateThemeExport(page, origin);
  await capture("create-theme-radius");
  await page.keyboard.press("Escape");
  await verifyPreviewRecovery(page, origin);
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    `Upstream Create behavior, generated command and captures passed: ${output}`
  );
} finally {
  await browser.close();
}
