import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import type { Request } from "playwright";
import { expect as baseExpect } from "playwright/test";

const expect = baseExpect.configure({ timeout: 60_000 });

interface RuntimeOptions {
  readonly app: string;
  readonly baseUrl: string;
  readonly output: string;
  readonly preset: string;
  readonly uiBase: "base" | "radix";
  readonly createUrl?: string;
  readonly live: boolean;
  readonly uploads: boolean;
  readonly documents: boolean;
}

// Tailwind serializes equivalent colors differently in a generated build and
// the live preview. Compare rendered sRGB channels rather than CSS source text.
const readTheme = (element: Element) => {
  const styles = getComputedStyle(element);
  const context = document.createElement("canvas").getContext("2d");
  if (context === null) {
    throw new Error("Canvas color normalization unavailable");
  }
  const colors = Object.fromEntries(
    ["--background", "--foreground", "--primary"].map((name) => {
      context.fillStyle = styles.getPropertyValue(name).trim();
      context.fillRect(0, 0, 1, 1);
      return [name, [...context.getImageData(0, 0, 1, 1).data]];
    })
  );
  return {
    colors,
    radius: Number(styles.getPropertyValue("--radius").replace("rem", "")),
  };
};

const readNativeRtl = async (app: string): Promise<boolean> => {
  const nativeConfig: unknown = JSON.parse(
    await readFile(path.join(app, "components.json"), "utf-8")
  );
  return (
    typeof nativeConfig === "object" &&
    nativeConfig !== null &&
    "rtl" in nativeConfig &&
    nativeConfig.rtl === true
  );
};

export const checkNativeRuntime = async (options: RuntimeOptions) => {
  const rtl = await readNativeRtl(options.app);
  const browser = await chromium.launch();
  const errors: string[] = [];
  const screenshots: string[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "light",
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    const pendingQueries = new Set<Request>();
    let lastQueryActivity = Date.now();
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/trpc/")) {
        pendingQueries.add(request);
        lastQueryActivity = Date.now();
      }
    });
    const finishQuery = (request: Request) => {
      if (pendingQueries.delete(request)) {
        lastQueryActivity = Date.now();
      }
    };
    page.on("requestfinished", finishQuery);
    page.on("requestfailed", finishQuery);
    // Reload tests persistence after the completed turn has settled. Aborting
    // its final background query would produce a navigation fetch error.
    const settleQueries = async () => {
      await expect
        .poll(
          () =>
            pendingQueries.size === 0 && Date.now() - lastQueryActivity >= 250
        )
        .toBe(true);
    };
    page.setDefaultTimeout(60_000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    await page.goto(`${options.baseUrl}/api/dev-login`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      rtl ? "rtl" : "ltr"
    );
    const composer = page.getByTestId("multimodal-input");
    await expect(composer).toBeVisible();
    await expect(composer).toHaveAttribute("contenteditable", "true");
    await expect(
      page.locator('input[type="file"][aria-label="Attach files"]')
    ).toHaveCount(options.uploads ? 1 : 0);
    if (options.uploads) {
      await page
        .getByRole("button", { name: "Composer options", exact: true })
        .click();
      await expect(
        page.getByRole("menuitem", { name: "Attach files", exact: true })
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await composer.fill("Generated composer accepts input");
    await expect(composer).toHaveText("Generated composer accepts input");
    await composer.fill("");
    await page.screenshot({
      path: path.join(options.output, "generated-desktop-light.png"),
      fullPage: true,
      animations: "disabled",
      style: "nextjs-portal { display: none !important; }",
    });
    screenshots.push("generated-desktop-light.png");
    if (options.live) {
      await composer.fill(
        "Reply with exactly: Generated ChatJS verification passed."
      );
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page).toHaveURL(/\/chat\//u);
      await expect(
        page.getByText("Generated ChatJS verification passed.", { exact: true })
      ).toBeVisible({ timeout: 180_000 });
      await expect(
        page.getByRole("button", { name: "Stop", exact: true })
      ).toHaveCount(0);
      await composer.fill("Conversation draft survives a reload");
      await settleQueries();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(composer).toHaveText("Conversation draft survives a reload");
      await composer.fill("");
      await expect(
        page.getByText("Generated ChatJS verification passed.", { exact: true })
      ).toBeVisible();
      await page.screenshot({
        path: path.join(options.output, "generated-live-chat.png"),
        fullPage: true,
        animations: "disabled",
        style: "nextjs-portal { display: none !important; }",
      });
      screenshots.push("generated-live-chat.png");
    }
    if (options.live && options.documents) {
      await composer.fill(
        'Use createTextDocument to create a document titled "Generated W8 note" containing exactly "Native generated document verified."'
      );
      await page.getByRole("button", { name: "Send", exact: true }).click();
      const documentResult = page.getByRole("button", {
        name: 'Created "Generated W8 note"',
        exact: true,
      });
      await expect(documentResult).toBeVisible({ timeout: 180_000 });
      await expect(
        page.getByRole("button", { name: "Stop", exact: true })
      ).toHaveCount(0);
      const close = page.getByRole("button", { name: "Close", exact: true });
      if (await close.isVisible()) {
        await close.click();
      }
      await documentResult.click();
      await expect(
        page
          .getByText("Native generated document verified.", { exact: true })
          .first()
      ).toBeVisible();
      await close.click();
      await settleQueries();
      await page.reload({ waitUntil: "domcontentloaded" });
      await documentResult.click();
      await expect(
        page
          .getByText("Native generated document verified.", { exact: true })
          .first()
      ).toBeVisible();
      await page.screenshot({
        path: path.join(options.output, "generated-live-document.png"),
        animations: "disabled",
        style: "nextjs-portal { display: none !important; }",
      });
      screenshots.push("generated-live-document.png");
      await close.click();
    }
    // Prove installed W5 code works under the selected native preset.
    const activity = await page.context().newPage();
    activity.on("pageerror", (error) => errors.push(error.message));
    await activity.goto(`${options.baseUrl}/native-ui-check`);
    await expect(
      activity.getByRole("heading", { name: "Generated activity verification" })
    ).toBeVisible();
    await expect(
      activity.getByRole("button", {
        name: "approval-requested Awaiting approval",
      })
    ).toBeVisible();
    const completed = activity.getByRole("button", {
      name: "output-available Completed",
    });
    await completed.press("Enter");
    await expect(completed).toHaveAttribute("aria-expanded", "false");
    await completed.press("Enter");
    await expect(completed).toHaveAttribute("aria-expanded", "true");
    await expect(
      activity.locator('[data-slot="code-block"][role="alert"]')
    ).toHaveText("ErrorSample tool failure");
    const token = activity.locator('[style*="--shiki-light"]').first();
    await expect(token).toBeVisible();
    assert.ok(
      await token.evaluate(
        (el) =>
          getComputedStyle(el).color !==
          getComputedStyle(el.closest("pre") ?? el).color
      ),
      "Generated highlighter token CSS must load"
    );
    await activity.getByRole("button", { name: "Copy", exact: true }).focus();
    await activity
      .getByRole("button", { name: "Copy", exact: true })
      .press("Enter");
    assert.equal(
      await activity.evaluate(async () => await navigator.clipboard.readText()),
      "const result = 42;\n"
    );
    await expect(
      activity.getByRole("button", { name: "Copied", exact: true })
    ).toBeVisible();
    await activity.screenshot({
      path: path.join(options.output, "generated-activity-light.png"),
      fullPage: true,
      animations: "disabled",
      style: "nextjs-portal { display: none !important; }",
    });
    screenshots.push("generated-activity-light.png");
    await activity.setViewportSize({ width: 390, height: 844 });
    await activity.emulateMedia({ colorScheme: "dark" });
    await expect(activity.locator("html")).toHaveClass(/dark/u);
    assert.ok(
      await activity.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    );
    await activity.screenshot({
      path: path.join(options.output, "generated-activity-mobile-dark.png"),
      fullPage: true,
      animations: "disabled",
      style: "nextjs-portal { display: none !important; }",
    });
    screenshots.push("generated-activity-mobile-dark.png");
    await activity.close();
    const theme = await page.locator("html").evaluate(readTheme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/dark/u);
    await expect(composer).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      "Generated mobile app overflows horizontally"
    );
    await page.screenshot({
      path: path.join(options.output, "generated-mobile-dark.png"),
      fullPage: true,
      animations: "disabled",
      style: "nextjs-portal { display: none !important; }",
    });
    screenshots.push("generated-mobile-dark.png");
    const darkTheme = await page.locator("html").evaluate(readTheme);
    if (options.createUrl !== undefined) {
      const create = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        colorScheme: "light",
      });
      create.on("pageerror", (error) => errors.push(error.message));
      create.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(message.text());
        }
      });
      const url = new URL(options.createUrl);
      url.searchParams.set("preset", options.preset);
      url.searchParams.set("base", options.uiBase);
      url.searchParams.set("rtl", String(rtl));
      url.searchParams.set("pointer", "true");
      url.searchParams.set(
        "gateway",
        options.uploads ? "openrouter" : "vercel"
      );
      url.searchParams.set("uploads", String(options.uploads));
      url.searchParams.set("storage", options.uploads ? "s3" : "vercel-blob");
      if (options.uploads) {
        url.searchParams.set(
          "storage-config",
          JSON.stringify({ bucket: "chatjs-native-smoke" })
        );
      }
      await create.goto(url.href, { waitUntil: "domcontentloaded" });
      const frame = create.frameLocator("iframe");
      await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
        "data-preset",
        options.preset
      );
      const previewTheme = await frame
        .getByTestId("chat-preview")
        .evaluate(readTheme);
      assert.deepEqual(
        previewTheme,
        theme,
        "Create and the generated app theme tokens must agree"
      );
      await create.screenshot({
        path: path.join(options.output, "create-desktop-light.png"),
        animations: "disabled",
      });
      screenshots.push("create-desktop-light.png");
      await create
        .getByRole("button", { name: "Get Code", exact: true })
        .first()
        .click();
      const command = await create.getByTestId("create-command").textContent();
      assert.ok(command !== null && command !== "");
      assert.ok(
        command.endsWith(
          ` -- --preset ${options.preset} --base ${options.uiBase} ${rtl ? "--rtl" : "--no-rtl"} --pointer`
        ),
        "Website must emit exactly the native flags exercised by generation"
      );
      assert.ok(
        command.includes(
          options.uploads
            ? "--gateway openrouter --attachments --storage-provider s3"
            : "--gateway vercel --no-attachments --storage-provider vercel-blob"
        )
      );
      if (options.uploads) {
        assert.ok(
          command.includes(
            `--storage-config '{"bucket":"chatjs-native-smoke"}'`
          )
        );
      }
      await create.keyboard.press("Escape");
      await create
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
      await create.setViewportSize({ width: 390, height: 844 });
      await create.emulateMedia({ colorScheme: "dark" });
      await expect(frame.getByTestId("chat-preview")).toHaveAttribute(
        "data-mode",
        "dark"
      );
      assert.deepEqual(
        await frame.getByTestId("chat-preview").evaluate(readTheme),
        darkTheme,
        "Create and generated app dark theme tokens must agree"
      );
      await create.screenshot({
        path: path.join(options.output, "create-mobile-dark.png"),
        animations: "disabled",
      });
      screenshots.push("create-mobile-dark.png");
    }
    assert.deepEqual(
      errors,
      [],
      "Generated app/Create must not raise uncaught browser errors"
    );
    return {
      app: options.app,
      preset: options.preset,
      uploads: options.uploads,
      liveChat: options.live,
      activityStates: 7,
      highlightedCodeCopy: true,
      documents: options.documents,
      isolatedDatabase: true,
      theme,
      darkTheme,
      screenshots,
      errors,
      limitations: [
        "GitHub OAuth is not exercised; authentication uses the local development login route.",
        ...(options.uploads
          ? [
              "OpenRouter completion and S3 transfer require their own credentials; this case verifies installation and runtime UI only.",
            ]
          : []),
      ],
    };
  } catch (error) {
    await Promise.all(
      browser
        .contexts()
        .flatMap((context) => context.pages())
        .map(async (page, index) => {
          await page.screenshot({
            path: path.join(options.output, `failure-${index}.png`),
            fullPage: true,
          });
        })
    );
    throw error;
  } finally {
    await browser.close();
  }
};
