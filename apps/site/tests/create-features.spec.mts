import catalogFixture from "./eve-catalog.fixture.json" with { type: "json" };
import { parseEveCatalog } from "../../../packages/registry/eve-catalog";
import {
  encodeAppPreset,
  readInstallationInput,
} from "../../../packages/registry/app-preset";
import { installationSelectionSchema } from "../../../packages/registry/installation";
import { commandAppPreset } from "./create-fixtures.mts";
import type { Page } from "playwright/test";
import { test, expect } from "@uiverify/playwright";
import { readFile } from "node:fs/promises";

const selectChoice = async (page: Page, label: string, option: string) => {
  await page
    .getByRole("radiogroup", { name: label, exact: true })
    .getByRole("radio", { name: option, exact: true })
    .check();
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/eve-catalog", async (route) => {
    await route.fulfill({ json: parseEveCatalog(catalogFixture) });
  });
});

for (const width of [1440, 390]) {
  test(`published file downloads without viewers at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 1000 });
    const installation = installationSelectionSchema.parse({
      gateway: "vercel",
      storage: { source: "vercel-blob" },
      tools: ["attach-workspace-file"],
      plugins: [],
    });
    await page.goto(
      `/create?item=preview-tools&app=${encodeAppPreset(installation)}`,
      { waitUntil: "domcontentloaded" }
    );
    const preview = page.frameLocator('iframe[title="Preview"]');
    await expect(preview.getByTestId("chat-preview")).toBeVisible();
    if (width === 390) {
      await page
        .getByRole("button", { name: "Mobile preview", exact: true })
        .click();
    }
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    const publish = page
      .locator("#agent-tool")
      .getByRole("checkbox", { name: "Attach Workspace File", exact: true });
    await expect(publish).toBeChecked();
    await publish.scrollIntoViewIfNeeded();
    await uiVerify.snapshot("publication tool in Agent");
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    const download = preview.getByRole("button", {
      name: "Download launch-budget.csv",
    });
    await expect(download).toBeVisible();
    await expect(
      preview
        .getByRole("region", { name: "Messages", exact: true })
        .getByRole("button", { name: /^Open /u })
    ).toHaveCount(0);
    await uiVerify.snapshot("published artifact without viewer");
    await page.screenshot({ path: testInfo.outputPath("published-file.png") });
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      download.click(),
    ]);
    expect(await file.failure()).toBeNull();
    expect(file.suggestedFilename()).toBe("launch-budget.csv");
    const path = await file.path();
    if (!path) {
      throw new Error("Missing download");
    }
    expect(await readFile(path, "utf-8")).toContain("Design,120");
    await page.getByRole("button", { name: "Get Code", exact: true }).click();
    const recipe = commandAppPreset(
      await page.getByTestId("create-command").textContent()
    );
    expect(recipe.tools).toContain("attach-workspace-file");
    expect(recipe.plugins).toEqual([]);
  });
}

test("Create sections share selections, dependencies and the install command", async ({
  page,
  uiVerify,
}, testInfo) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  const preview = page.frameLocator('iframe[title="Preview"]');
  await expect(preview.getByTestId("chat-preview")).toBeVisible();
  const draft = preview.getByRole("textbox", { name: "Message", exact: true });
  await draft.fill("Keep this while configuring my setup");
  const originalDocument = await preview.locator("body").elementHandle();
  await expect(
    page.getByRole("tablist", { name: "Create workspace" }).getByRole("tab")
  ).toHaveText(["Appearance", "Plugins", "Agent", "Setup"]);
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  const panel = page.getByRole("region", { name: "Configure your app" });
  await expect(panel.getByRole("heading", { level: 3 })).toHaveText([
    "Conversations",
    "Responses",
    "Files & connections",
    "Access & usage",
  ]);
  await expect(panel.getByRole("switch", { name: "Langfuse" })).toHaveCount(0);
  await panel
    .getByRole("switch", { name: "Attachment Uploads", exact: true })
    .check();
  await uiVerify.snapshot("design features");
  await page.screenshot({ path: testInfo.outputPath("features-desktop.png") });
  await panel
    .getByRole("switch", { name: "Credits", exact: true })
    .scrollIntoViewIfNeeded();
  await uiVerify.snapshot("access plugins");
  await page.getByRole("button", { name: "Setup requirements" }).click();
  await page.getByRole("button", { name: "Open Setup", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Set up your app." })
  ).toBeVisible();
  await expect(page.locator('iframe[title="Preview"]')).toBeHidden();
  await expect(
    page
      .getByTestId("setup-scroll")
      .getByRole("region", { name: "Observability", exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Setup sections" }).getByRole("link")
  ).toHaveText(["Models & Gateways", "Infrastructure", "Platforms"]);
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  const tools = page.getByRole("region", {
    name: "Tools",
    exact: true,
  });
  await expect(
    page.getByRole("region", { name: "Application capabilities", exact: true })
  ).toHaveCount(0);
  const extensions = page.getByRole("region", {
    name: "Extensions",
    exact: true,
  });
  await extensions
    .getByRole("checkbox", { name: "Deep Research", exact: true })
    .check();
  await expect(
    tools.getByRole("checkbox", { name: "Attach Workspace File", exact: true })
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "About Attach Workspace File", exact: true })
    .click();
  await expect(
    page.getByText("Required by Deep Research", { exact: true })
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await extensions
    .getByRole("checkbox", { name: "Deep Research", exact: true })
    .uncheck();
  await expect(
    tools.getByRole("checkbox", { name: "Attach Workspace File", exact: true })
  ).not.toBeChecked();
  await page.getByTestId("eve-connection/linear").getByRole("checkbox").check();
  await uiVerify.snapshot("AI tools");
  await page.screenshot({ path: testInfo.outputPath("tools-desktop.png") });
  await page.getByRole("tab", { name: "Setup", exact: true }).click();
  await selectChoice(page, "File storage", "S3");
  await page
    .getByLabel("Storage bucket", { exact: true })
    .fill("my-chat-files");
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  await page
    .getByRole("radiogroup", { name: "Sandbox", exact: true })
    .getByRole("radio", { name: "Vercel Sandbox", exact: true })
    .check();
  await page.getByRole("tab", { name: "Setup", exact: true }).click();
  await expect(page.getByLabel("Storage bucket", { exact: true })).toHaveValue(
    "my-chat-files"
  );
  await page
    .getByRole("button", { name: "Your app summary", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Your app summary" })
  ).toContainText("Ready to install");
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Models & Gateways", exact: true })
    .click();
  await uiVerify.snapshot("square setup provider tiles light");
  await page.screenshot({ path: testInfo.outputPath("stack-desktop.png") });
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  expect(
    await originalDocument?.evaluate((element) => element.isConnected)
  ).toBe(true);
  await expect(draft).toHaveText("Keep this while configuring my setup");
  await expect(
    panel.getByRole("switch", { name: "Attachment Uploads", exact: true })
  ).toBeChecked();
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  await expect(
    page.getByTestId("eve-connection/linear").getByRole("checkbox")
  ).toBeChecked();
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("button", { name: "Tool examples", exact: true })
    .click();
  await expect(page).toHaveURL(/item=preview-tools/u);
  await page.reload();
  const selectionQuery = new URL(page.url()).searchParams;
  expect(selectionQuery.get("app")).toMatch(/^agent1_[A-Za-z0-9_-]+$/u);
  const requested = readInstallationInput(selectionQuery.get("app") ?? "");
  expect(requested.storage?.options.bucket).toBe("my-chat-files");
  expect(requested.plugins).toEqual(["attachment-uploads"]);
  expect(requested.tools).toEqual([]);
  expect(requested.eve).toEqual(["connection/linear"]);
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const command = page.getByTestId("create-command");
  await expect(command).toContainText("--app-preset");
  expect(commandAppPreset(await command.textContent()).plugins).toEqual([
    "attachment-uploads",
  ]);
  expect(commandAppPreset(await command.textContent()).sandbox).toBe("vercel");
  expect(
    commandAppPreset(await command.textContent()).storage?.options.bucket
  ).toBe("my-chat-files");
  expect(commandAppPreset(await command.textContent()).eve).toEqual([
    "connection/linear",
  ]);
  await page.getByRole("button", { name: "Copy Command", exact: true }).click();
  expect(
    await page.evaluate(async () => await navigator.clipboard.readText())
  ).toContain("--app-preset");
  expect(errors).toEqual([]);
});

test("invalid links block export and retain a recovery action in both views", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.goto("/create?app=broken");
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Start a new setup" })
  ).toBeVisible();
  await page.getByRole("tab", { name: "Setup", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Start a new setup" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Copy Command", exact: true })
  ).toBeDisabled();
});

test("namespaced selections and missing providers remain editable", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.goto(
    `/create?app=${encodeAppPreset(installationSelectionSchema.parse({ plugins: ["@chatjs/feedback"], tools: [] }))}`
  );
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  const feedback = page.getByRole("switch", { name: "Feedback", exact: true });
  await expect(feedback).toBeChecked();
  await feedback.uncheck();
  await expect(feedback).not.toBeChecked();
  await page.getByRole("tab", { name: "Setup", exact: true }).click();
  const gateway = page.getByRole("radiogroup", { name: "Model gateway" });
  await expect(gateway.getByRole("radio", { checked: true })).toHaveCount(0);
  await selectChoice(page, "Model gateway", "Vercel AI Gateway");
  await page
    .getByRole("button", { name: "Your app summary", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Your app summary" })
  ).toContainText("Ready to install");
  await page.keyboard.press("Escape");
  const storage = page.getByRole("radiogroup", {
    name: "File storage",
    exact: true,
  });
  await expect(storage.getByRole("radio")).toHaveCount(4);
  await page.getByRole("button", { name: /^Show all .* providers$/u }).click();
  await page
    .getByRole("textbox", { name: "Search storage providers" })
    .fill("Azure");
  await expect(storage.getByRole("radio")).toHaveCount(1);
  await storage
    .getByRole("radio", { name: "Azure Blob Storage", exact: true })
    .check();
  await uiVerify.snapshot("custom storage selection");
  await page
    .getByRole("textbox", { name: "Search storage providers" })
    .fill("no matching provider");
  await expect(page.getByRole("status")).toHaveText(
    "No providers match “no matching provider”."
  );
  await uiVerify.snapshot("empty provider search");
  await page.getByRole("button", { name: "Show fewer providers" }).click();
  await expect(
    storage.getByRole("radio", { name: "Azure Blob Storage", exact: true })
  ).toBeChecked();
  await expect(storage.getByRole("radio")).toHaveCount(5);
  // Native radio keyboard behavior and explicit opt-out survive URL serialization.
  await gateway.getByRole("radio", { name: "Vercel AI Gateway" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    gateway.getByRole("radio", { name: "OpenAI", exact: true })
  ).toBeChecked();
  await selectChoice(page, "File storage", "No persistent storage");
  await expect(
    page
      .getByRole("radiogroup", { name: "File storage" })
      .getByRole("radio", { name: "No persistent storage" })
  ).toBeChecked();
});

for (const width of [1440, 390]) {
  test(`configuration stays anchored and switches views at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/create?item=preview-02");
    const frame = page.locator('iframe[title="Preview"]');
    const preview = page.frameLocator('iframe[title="Preview"]');
    await expect(preview.getByTestId("chat-preview")).toBeVisible();
    await page.evaluate(async () => await document.fonts.ready);
    const initialFrame = await frame.boundingBox();
    expect(initialFrame?.height).toBeGreaterThan(200);
    const categories = page.getByRole("tablist", {
      name: "Create workspace",
      includeHidden: true,
    });
    const initialCategories = await categories.boundingBox();
    const getCode = page.locator("header").getByRole("button", {
      name: "Get Code",
      exact: true,
      includeHidden: true,
    });
    await expect(getCode).toBeEnabled();
    await expect(getCode).toBeInViewport();
    const initialGetCode = await getCode.boundingBox();
    await uiVerify.snapshot("appearance");
    const unchangedFrame = async () => {
      expect(await frame.boundingBox()).toEqual(initialFrame);
      expect(await categories.boundingBox()).toEqual(initialCategories);
      expect(await getCode.boundingBox()).toEqual(initialGetCode);
    };
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    await expect(frame).toBeHidden();
    expect(await categories.boundingBox()).toEqual(initialCategories);
    await uiVerify.snapshot("Agent panel");
    await page.screenshot({
      path: testInfo.outputPath("ai-tools.png"),
      animations: "disabled",
    });
    await page.getByRole("tab", { name: "Plugins", exact: true }).click();
    await unchangedFrame();
    const feedback = page.getByRole("switch", {
      name: "Feedback",
      exact: true,
    });
    await feedback.scrollIntoViewIfNeeded();
    const before = await feedback.boundingBox();
    await feedback.check();
    expect(await feedback.boundingBox()).toEqual(before);
    await expect(preview.getByTestId("message-upvote")).toBeVisible();
    await unchangedFrame();
    await page
      .getByRole("button", { name: "About Feedback", exact: true })
      .click();
    await unchangedFrame();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Setup requirements" }).click();
    await unchangedFrame();
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: testInfo.outputPath("design.png"),
      animations: "disabled",
    });
    await uiVerify.snapshot("design");
    await page
      .getByRole("button", { name: "Toggle theme", exact: true })
      .click();
    await expect(page.locator("html")).toHaveClass(/dark/u);
    await expect(page.getByRole("link", { name: "ChatJS home" })).toBeVisible();
    await unchangedFrame();
    await page.screenshot({
      path: testInfo.outputPath("app-dark.png"),
      animations: "disabled",
    });
    await page.getByRole("tab", { name: "Setup", exact: true }).click();
    await selectChoice(page, "Model gateway", "OpenRouter");
    await expect(
      page.getByRole("button", { name: "Get Code", exact: true }).first()
    ).toBeInViewport();
    await uiVerify.snapshot("square setup provider tiles dark");
    await page.screenshot({
      path: testInfo.outputPath("stack.png"),
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    const setupNav = page.getByRole("navigation", { name: "Setup sections" });
    await (width < 1024
      ? setupNav
          .getByLabel("Jump to category")
          .selectOption({ label: "Platforms" })
      : setupNav.getByRole("link", { name: "Platforms", exact: true }).click());
    await expect(
      page.getByRole("checkbox", { name: "Desktop", exact: true })
    ).toBeInViewport();
    await uiVerify.snapshot("platform plugins");
    await page.getByRole("tab", { name: "Plugins", exact: true }).click();
    await unchangedFrame();
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    await unchangedFrame();
    await page.getByRole("button", { name: "Style Nova", exact: true }).click();
    await unchangedFrame();
    await page.keyboard.press("Escape");
    await getCode.click();
    expect(
      commandAppPreset(await page.getByTestId("create-command").textContent())
        .plugins
    ).toEqual(["feedback"]);
    await unchangedFrame();
  });
}

test("Get Code selects either library without replacing the preview", async ({
  page,
  uiVerify,
}, testInfo) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/create?app=${encodeAppPreset(
      installationSelectionSchema.parse({
        gateway: "vercel",
        plugins: ["feedback"],
        tools: [],
        sandbox: "vercel",
      })
    )}`
  );
  const preview = page.frameLocator("iframe");
  const draft = preview.getByRole("textbox", { name: "Message", exact: true });
  await draft.fill("Keep this draft");
  const originalDocument = await preview.locator("body").elementHandle();
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Create your ChatJS app" });
  const command = dialog.getByTestId("create-command");
  await expect(
    dialog.getByRole("button", { name: "Base UI", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(command).toContainText("--base base");
  expect(commandAppPreset(await command.textContent()).sandbox).toBe("vercel");
  await expect(dialog.getByRole("switch")).toHaveAccessibleName(
    "Use pointer on buttons"
  );
  await expect(dialog.getByText("React Aria", { exact: true })).toHaveCount(0);
  await expect(
    dialog.getByRole("group", { name: "Template", exact: true })
  ).toHaveCount(0);
  const appPresetCode = dialog.getByTestId("app-preset-code");
  const expectPresetToFit = async () => {
    await expect(appPresetCode).toHaveAttribute(
      "title",
      (await appPresetCode.textContent()) ?? ""
    );
    expect(
      await appPresetCode.evaluate((element) => {
        const code = element.getBoundingClientRect();
        const summary = element.closest("dl")?.getBoundingClientRect();
        return (
          summary && code.left >= summary.left && code.right <= summary.right
        );
      })
    ).toBe(true);
  };
  await expectPresetToFit();
  await uiVerify.snapshot("get code base");
  await page.screenshot({ path: testInfo.outputPath("get-code-base.png") });
  await dialog.getByRole("button", { name: "Radix UI", exact: true }).click();
  await dialog.getByRole("switch", { name: "Use pointer on buttons" }).check();
  await expect(command).toContainText("--base radix --no-rtl --pointer");
  expect(commandAppPreset(await command.textContent()).plugins).toEqual([
    "feedback",
  ]);
  await expect(dialog.getByTestId("app-preset-code")).toHaveText(
    /agent1_[A-Za-z0-9_-]+/u
  );
  await expect(dialog.getByTestId("appearance-preset-code")).toHaveText(
    /b[0-9A-Za-z]+/u
  );
  await dialog
    .getByRole("button", { name: "Copy Command", exact: true })
    .click();
  expect(
    await page.evaluate(async () => await navigator.clipboard.readText())
  ).toContain("--base radix");
  await uiVerify.snapshot("get code radix");
  await page.screenshot({ path: testInfo.outputPath("get-code-radix.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeInViewport();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true);
  await expectPresetToFit();
  await uiVerify.snapshot("get code mobile");
  await page.screenshot({ path: testInfo.outputPath("get-code-mobile.png") });
  await page.keyboard.press("Escape");
  expect(
    await originalDocument?.evaluate((element) => element.isConnected)
  ).toBe(true);
  await expect(draft).toHaveText("Keep this draft");
  await expect(preview.getByTestId("chat-preview")).toHaveAttribute(
    "data-base",
    "base"
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const shared = await page.evaluate(
    async () => await navigator.clipboard.readText()
  );
  expect(new URL(shared).searchParams.get("base")).toBe("radix");
  await page.goto(shared);
  await expect(preview.getByTestId("chat-preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await expect(
    dialog.getByRole("button", { name: "Radix UI", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(command).toContainText("--base radix");
  await dialog.getByRole("button", { name: "Base UI", exact: true }).click();
  await expect(command).toContainText("--base base");
});

/* eslint-disable no-await-in-loop -- Exercise dependent selections sequentially to measure each layout change. */
// Dependency explanations and validation status must not move selection targets.
for (const width of [1440, 1024, 390]) {
  test(`selections keep geometry and scroll position at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    const installation = {
      gateway: "vercel",
      plugins: [],
      tools: [],
      storage: { source: "s3", options: {} },
      sandbox: "vercel",
    };
    await page.goto(
      `/create?app=${encodeAppPreset(installationSelectionSchema.parse(installation))}`
    );
    await expect(
      page.frameLocator('iframe[title="Preview"]').getByTestId("chat-preview")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Get Code", exact: true }).first()
    ).toBeEnabled();
    await expect(
      page.getByText("Loading preview…", { exact: true })
    ).toBeHidden();
    await page.getByRole("tab", { name: "Setup", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Set up your app." })
    ).toBeVisible();
    await page.evaluate(async () => await document.fonts.ready);
    const tools = page.getByRole("region", {
      name: "Tools",
      exact: true,
    });
    const scroll = page.getByTestId("agent-scroll");
    const summary = page.getByRole("complementary", {
      name: "Your app summary",
    });
    const geometry = async () =>
      await tools.locator('label[for^="feature-"]').evaluateAll((cards) =>
        cards.map((card) => {
          const rect = card.getBoundingClientRect();
          const container = card.closest('[data-testid="agent-scroll"]');
          return {
            x: rect.x,
            y: rect.y + (container?.scrollTop ?? 0),
            width: rect.width,
            height: rect.height,
          };
        })
      );
    const summaryGeometry = async () =>
      await summary.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          height: bounds.height,
          controls: [...element.querySelectorAll("button")].map((button) => {
            const rect = button.getBoundingClientRect();
            return {
              x: rect.x - bounds.x,
              y: rect.y - bounds.y,
              width: rect.width,
              height: rect.height,
            };
          }),
        };
      });
    await page
      .getByRole("button", { name: "Your app summary", exact: true })
      .click();
    const beforeSummary = await summaryGeometry();
    await expect(summary).toContainText("Review setup · 1 choice needed");
    await page.keyboard.press("Escape");
    await page
      .getByLabel("Storage bucket", { exact: true })
      .fill("preview-files");
    await page
      .getByRole("button", { name: "Your app summary", exact: true })
      .click();
    await expect(summary).toContainText("Ready to install");
    expect(await summaryGeometry()).toEqual(beforeSummary);
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    const before = await geometry();
    // Each click is explicitly brought into view before measuring: browser scrolling
    // to reach an offscreen control is distinct from a selection shifting the layout.
    for (const checked of [true, false]) {
      const names = [
        "Generate Image",
        "Generate Video",
        "Attach Workspace File",
        "Deep Research",
      ];
      for (const name of checked ? names : names.toReversed()) {
        const control = page.getByRole("checkbox", { name, exact: true });
        await control.scrollIntoViewIfNeeded();
        const scrollBefore = await scroll.evaluate(
          (element) => element.scrollTop
        );
        await control.setChecked(checked);
        await expect(control).toBeChecked({ checked });
        expect(await geometry()).toEqual(before);
        expect(await scroll.evaluate((element) => element.scrollTop)).toBe(
          scrollBefore
        );
      }
      await tools
        .getByRole("button", {
          name: "About Attach Workspace File",
          exact: true,
        })
        .click();

      await page.screenshot({
        path: testInfo.outputPath(`dependencies-${checked}.png`),
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      expect(await geometry()).toEqual(before);
    }
    await page.getByRole("tab", { name: "Setup", exact: true }).click();
    await page
      .getByRole("button", { name: "Your app summary", exact: true })
      .click();
    expect(await summaryGeometry()).toEqual(beforeSummary);
    expect(errors).toEqual([]);
  });
}

/* eslint-enable no-await-in-loop */

test("built-in tool examples render published files without document editors", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  const installation = installationSelectionSchema.parse({
    gateway: "vercel",
    plugins: [],
    sandbox: "vercel",
    storage: { source: "vercel-blob", options: {} },
    tools: [
      "generate-image",
      "generate-video",
      "deep-research",
      "attach-workspace-file",
    ],
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `/create?item=preview-tools&app=${encodeAppPreset(installation)}`
  );
  const preview = page.frameLocator('iframe[title="Preview"]');
  await expect(
    preview.getByText("launch-budget.csv", { exact: true })
  ).toBeVisible();
  await expect(
    preview
      .getByRole("region", { name: "Messages", exact: true })
      .getByRole("alert")
  ).toHaveCount(0);
  await uiVerify.snapshot("published file examples");
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`tool examples show real results and one setup action at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const installation = {
      gateway: "vercel",
      plugins: [],
      tools: ["generate-image", "generate-video"],
    };
    await page.goto(
      `/create?item=preview-tools&app=${encodeAppPreset(installationSelectionSchema.parse(installation))}`
    );
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    const preview = page.frameLocator('iframe[title="Preview"]');
    await expect(
      preview.getByText(
        "Sample results for your selected tools. No external services are called."
      )
    ).toBeAttached();
    await expect(
      preview
        .getByRole("region", { name: "Messages", exact: true })
        .getByRole("alert")
    ).toHaveCount(0);
    await expect(preview.getByText(/sample error state/u)).toHaveCount(0);
    const generatedImage = preview.getByRole("img", {
      name: "A minimal landscape with rolling green hills",
      exact: true,
    });
    await expect(generatedImage).toBeAttached();
    await expect
      .poll(
        async () =>
          await generatedImage.evaluate(
            (image: HTMLImageElement) => image.naturalWidth
          )
      )
      .toBeGreaterThan(0);
    await expect
      .poll(
        async () =>
          await preview
            .locator("video")
            .evaluate((video: HTMLVideoElement) => video.readyState)
      )
      .toBeGreaterThanOrEqual(2);
    await preview.locator("video").evaluate((video: HTMLVideoElement) => {
      video.pause();
      video.currentTime = 0;
    });
    await expect(
      page.getByRole("button", { name: "Get Code", exact: true })
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Configure services" })
    ).toHaveCount(0);
    const frameBounds = await page
      .locator('iframe[title="Preview"]')
      .boundingBox();
    await page.getByRole("button", { name: "Setup requirements" }).click();
    await expect(page.getByLabel("Installation issues")).toBeVisible();
    await uiVerify.snapshot("tool results and setup requirements");
    await page.getByRole("button", { name: "Open Setup", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "Setup", exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    expect(await page.locator('iframe[title="Preview"]').boundingBox()).toEqual(
      frameBounds
    );
    await generatedImage.scrollIntoViewIfNeeded();
    await uiVerify.snapshot("successful media examples");
    await page.screenshot({
      path: testInfo.outputPath("tool-results.png"),
      animations: "disabled",
    });
    expect(errors).toEqual([]);
  });
}

for (const width of [1440, 390]) {
  test(`Get Code review resolves setup without losing selections at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 1000 });
    const installation = {
      plugins: ["feedback"],
      tools: ["attach-workspace-file"],
      sandbox: "just-bash",
      gateway: "vercel",
    };
    await page.goto(
      `/create?app=${encodeAppPreset(installationSelectionSchema.parse(installation))}`
    );
    await expect(
      page.frameLocator('iframe[title="Preview"]').getByTestId("chat-preview")
    ).toBeVisible();
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    await page
      .getByTestId("agent-scroll")
      .getByRole("button", { name: "Configure storage" })
      .scrollIntoViewIfNeeded();
    await expect(
      page
        .getByTestId("agent-scroll")
        .getByRole("button", { name: "Configure storage" })
    ).toBeVisible();
    await uiVerify.snapshot("contextual setup action");
    await page.screenshot({
      path: testInfo.outputPath("contextual-setup.png"),
    });
    await page
      .getByTestId("agent-scroll")
      .getByRole("button", { name: "Configure storage" })
      .click();
    await expect(
      page.getByRole("radiogroup", { name: "File storage", exact: true })
    ).toBeInViewport();
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    await expect(
      page
        .getByTestId("agent-scroll")
        .getByRole("checkbox", { name: "Attach Workspace File", exact: true })
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Get Code", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("region", { name: "Selection summary" })
    ).toContainText("Feedback");
    await expect(
      dialog.getByRole("button", { name: "Copy Command", exact: true })
    ).toBeDisabled();
    await uiVerify.snapshot("incomplete installation review");
    await page.screenshot({
      path: testInfo.outputPath("installation-review.png"),
    });
    await dialog.getByRole("button", { name: "Configure storage" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("radiogroup", { name: "File storage", exact: true })
    ).toBeInViewport();
    await page
      .getByRole("radiogroup", { name: "File storage", exact: true })
      .getByRole("radio", { name: "Vercel Blob", exact: true })
      .check();
    await page.getByRole("tab", { name: "Agent", exact: true }).click();
    await expect(
      page
        .getByTestId("agent-scroll")
        .getByRole("checkbox", { name: "Attach Workspace File", exact: true })
    ).toBeChecked();
    await expect(
      page
        .getByTestId("agent-scroll")
        .getByRole("button", { name: "Configure storage" })
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Get Code", exact: true })
      .first()
      .click();
    expect(
      commandAppPreset(await dialog.getByTestId("create-command").textContent())
        .tools
    ).toContain("attach-workspace-file");
    await expect(
      dialog.getByRole("button", { name: "Copy Command", exact: true })
    ).toBeEnabled();
    await expect(dialog).toContainText(
      "Add API keys and other credentials after installation."
    );
    await uiVerify.snapshot("ready installation review");
  });
}

for (const width of [390, 740]) {
  test(`narrow editor gives space to a scrollable preview at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    const frame = page.locator('iframe[title="Preview"]');
    const preview = page.frameLocator('iframe[title="Preview"]');
    await expect(preview.getByTestId("chat-preview")).toBeVisible();
    const viewport = page.getByTestId("preview-viewport");
    const settings = page.getByRole("complementary", {
      name: "App configuration",
    });
    const viewportBox = await viewport.boundingBox();
    const settingsBox = await settings.boundingBox();
    if (!viewportBox || !settingsBox) {
      throw new Error("Missing Create layout");
    }
    expect(settingsBox.height).toBeLessThan(220);
    expect(viewportBox.height).toBeGreaterThan(400);
    expect(settingsBox.y - (viewportBox.y + viewportBox.height)).toBeLessThan(
      32
    );
    expect(
      await viewport.evaluate(
        (element) =>
          element.scrollWidth > element.clientWidth &&
          element.scrollHeight > element.clientHeight
      )
    ).toBe(true);
    const scene = page.getByRole("group", {
      name: "Preview scene",
      exact: true,
    });
    const sceneBox = await scene.boundingBox();
    if (!sceneBox) {
      throw new Error("Missing scene controls");
    }
    expect(sceneBox.y).toBeGreaterThan(viewportBox.y + viewportBox.height - 65);
    await viewport.hover({ position: { x: 15, y: 15 } });
    await page.mouse.wheel(300, 300);
    await expect
      .poll(
        async () =>
          await viewport.evaluate(
            (element) => element.scrollLeft > 0 && element.scrollTop > 0
          )
      )
      .toBe(true);
    await viewport.evaluate((element) => {
      element.scrollTo(0, 0);
    });
    const documentBefore = await preview.locator("body").elementHandle();
    await uiVerify.snapshot("narrow desktop canvas with appearance dock");
    await page.screenshot({ path: testInfo.outputPath("mobile-editor.png") });
    await page
      .getByRole("button", { name: "Mobile preview", exact: true })
      .click();
    await expect
      .poll(async () => {
        const bounds = await frame.boundingBox();
        return bounds?.width;
      })
      .toBe(390);
    expect(
      await documentBefore?.evaluate((element) => element.isConnected)
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("mobile-canvas.png") });
    await viewport.evaluate((element) => {
      element.scrollTo(0, element.scrollHeight);
    });
    const composer = await preview
      .getByRole("textbox", { name: "Message", exact: true })
      .boundingBox();
    const controls = await scene.boundingBox();
    if (!composer || !controls) {
      throw new Error("Missing composer or scene controls");
    }
    expect(composer.y + composer.height).toBeLessThanOrEqual(controls.y);
    await page.getByRole("tab", { name: "Plugins", exact: true }).click();
    await page.getByRole("switch", { name: "Feedback", exact: true }).check();
    await expect(preview.getByTestId("message-upvote")).toBeVisible();
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    expect(
      await documentBefore?.evaluate((element) => element.isConnected)
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await uiVerify.snapshot("narrow mobile canvas");
  });
}

for (const media of ["image", "video"]) {
  const title = media === "image" ? "Image" : "Video";
  for (const width of [1440, 390]) {
    test(`${media} tool and optional viewer compose at ${width}px`, async ({
      page,
      uiVerify,
    }, testInfo) => {
      uiVerify.disableAutoSnapshot();
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const installation = installationSelectionSchema.parse({
        gateway: "vercel",
        storage: { source: "vercel-blob" },
        tools: [`generate-${media}`],
        plugins: [],
      });
      await page.goto(
        `/create?item=preview-tools&app=${encodeAppPreset(installation)}`,
        { waitUntil: "domcontentloaded" }
      );
      const preview = page.frameLocator('iframe[title="Preview"]');
      await expect(preview.getByTestId("chat-preview")).toBeVisible();
      if (width === 390) {
        await page
          .getByRole("button", { name: "Mobile preview", exact: true })
          .click();
      }
      await page.getByRole("tab", { name: "Agent", exact: true }).click();
      const tools = page.locator("#agent-tool");
      await expect(
        tools.getByRole("checkbox", { name: `Generate ${title}`, exact: true })
      ).toBeChecked();
      await expect(
        page
          .locator("#agent-application")
          .getByRole("checkbox", { name: `Generate ${title}`, exact: true })
      ).toHaveCount(0);
      await tools
        .getByRole("checkbox", { name: `Generate ${title}`, exact: true })
        .scrollIntoViewIfNeeded();
      await uiVerify.snapshot(`${media} generation in native Tools category`);
      await page.screenshot({ path: testInfo.outputPath(`${media}-tool.png`) });
      await page.getByRole("tab", { name: "Plugins", exact: true }).click();
      const viewer = page.getByRole("switch", {
        name: `${title} viewer`,
        exact: true,
      });
      await expect(viewer).not.toBeChecked();
      const download = preview.getByRole("button", {
        name: `Download ${media}`,
        exact: true,
      });
      await expect(download).toBeVisible();
      await expect(
        preview.getByRole("button", { name: `Open ${media}`, exact: true })
      ).toHaveCount(0);
      await uiVerify.snapshot(`${media} card without optional viewer`);
      await page.screenshot({
        path: testInfo.outputPath(`${media}-without-viewer.png`),
      });
      const [file] = await Promise.all([
        page.waitForEvent("download"),
        download.click(),
      ]);
      expect(await file.failure()).toBeNull();
      await viewer.check();
      const open = preview.getByRole("button", {
        name: `Open ${media}`,
        exact: true,
      });
      await expect(open).toBeVisible();
      if (media === "video") {
        expect(file.suggestedFilename()).toMatch(/\.mp4$/u);
        await preview.locator("video").evaluate(async (video) => {
          if (!(video instanceof HTMLVideoElement)) {
            throw new Error("Expected video player");
          }
          await video.play();
        });
        await expect(preview.locator("video")).toHaveJSProperty(
          "paused",
          false
        );
      }
      await open.click();
      const dialog = preview.getByRole("dialog");
      await expect(dialog).toBeVisible();
      if (media === "image") {
        await expect(dialog.getByRole("img")).toBeVisible();
      } else {
        await expect(preview.locator("video").first()).toHaveJSProperty(
          "paused",
          true
        );
        await expect(dialog.locator("video")).toBeVisible();
        await dialog.locator("video").evaluate(async (video) => {
          if (!(video instanceof HTMLVideoElement)) {
            throw new Error("Expected video player");
          }
          await video.play();
        });
        await expect(dialog.locator("video")).toHaveJSProperty("paused", false);
        await dialog.locator("video").evaluate((video) => {
          if (!(video instanceof HTMLVideoElement)) {
            throw new Error("Expected video player");
          }
          video.pause();
          video.currentTime = 0;
        });
      }
      await uiVerify.snapshot(`optional ${media} viewer open`);
      await page.screenshot({
        path: testInfo.outputPath(`${media}-viewer-open.png`),
      });
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await viewer.uncheck();
      await expect(open).toHaveCount(0);
      await expect(download).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [1440, 390]) {
  test(`spreadsheet viewer opens published CSV at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const app = encodeAppPreset(
      installationSelectionSchema.parse({
        gateway: "vercel",
        storage: { source: "vercel-blob", options: {} },
        plugins: ["spreadsheet-viewer"],
        tools: ["attach-workspace-file"],
      })
    );
    await page.goto(`/create?item=preview-tools&app=${app}`);
    if (width === 390) {
      await page
        .getByRole("button", { name: "Mobile preview", exact: true })
        .click();
    }
    const preview = page.frameLocator('iframe[title="Preview"]');
    await expect(preview.getByTestId("chat-preview")).toBeVisible();
    await preview.getByRole("button", { name: "Open spreadsheet" }).click();
    await expect(preview.getByRole("dialog")).toBeVisible();
    await expect(
      preview.getByRole("gridcell", { name: "Design", exact: true })
    ).toBeVisible();
    await expect(preview.getByRole("dialog").getByRole("textbox")).toHaveCount(
      0
    );
    await expect(
      preview.getByRole("button", { name: "Download spreadsheet" })
    ).toBeVisible();
    expect(
      await preview.getByRole("dialog").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.right <= window.innerWidth &&
          document.documentElement.scrollWidth <= window.innerWidth
        );
      })
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("spreadsheet-viewer.png"),
    });
  });
}
