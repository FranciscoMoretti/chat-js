import { readInstallationInput } from "../../../packages/registry/app-preset";
import { commandAppPreset } from "./create-fixtures.mts";
import type { Page } from "playwright/test";
import { test, expect } from "@uiverify/playwright";

const selectChoice = async (page: Page, label: string, option: string) => {
  await page
    .getByRole("radiogroup", { name: label, exact: true })
    .getByRole("radio", { name: option, exact: true })
    .check();
};
const checkRequirements = async (page: Page) => {
  await page.getByRole("button", { name: "Setup requirements" }).click();
  await expect(page.getByLabel("Installation issues")).toContainText(
    "persistent sandbox"
  );
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Installation issues")).toBeHidden();
};

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
  ).toHaveText(["Appearance", "Plugins", "AI tools", "Setup"]);
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  const panel = page.getByRole("region", { name: "Configure your app" });
  await expect(panel.getByRole("switch")).toHaveCount(11);
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
  await checkRequirements(page);
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
  const observability = page.getByRole("region", {
    name: "Observability",
    exact: true,
  });
  await expect(observability.getByRole("checkbox")).toHaveCount(3);
  await observability
    .getByRole("checkbox", { name: "Langfuse", exact: true })
    .check();
  await expect(
    page.getByRole("navigation", { name: "Setup sections" }).getByRole("link")
  ).toHaveText([
    "Models & Gateways",
    "Infrastructure",
    "Observability",
    "Platforms",
  ]);
  await page.getByRole("tab", { name: "AI tools", exact: true }).click();
  const tools = page.getByRole("region", { name: "AI tools", exact: true });
  await expect(tools.getByRole("heading", { level: 3 })).toHaveText([
    "Search & research",
    "Documents",
    "Media",
    "Execution",
    "Utilities",
  ]);
  await tools
    .getByRole("checkbox", { name: "Deep Research", exact: true })
    .check();
  await expect(
    tools.getByRole("checkbox", { name: "Text Documents", exact: true })
  ).toBeChecked();
  await expect(
    tools.getByRole("checkbox", { name: "Text Documents", exact: true })
  ).toBeDisabled();
  await tools.getByRole("button", { name: "About Text Documents" }).click();
  await expect(
    page.getByText("Required by Deep Research", { exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await tools
    .getByRole("checkbox", { name: "Deep Research", exact: true })
    .uncheck();
  await expect(
    tools.getByRole("checkbox", { name: "Text Documents", exact: true })
  ).not.toBeChecked();
  await tools
    .getByRole("checkbox", { name: "Get Weather", exact: true })
    .check();
  await uiVerify.snapshot("AI tools");
  await page.screenshot({ path: testInfo.outputPath("tools-desktop.png") });
  await page.getByRole("tab", { name: "Setup", exact: true }).click();
  await selectChoice(page, "File storage", "S3");
  await page
    .getByLabel("Storage bucket", { exact: true })
    .fill("my-chat-files");
  await selectChoice(page, "Sandbox", "Daytona");
  await checkRequirements(page);
  await selectChoice(page, "Sandbox", "Vercel Sandbox");
  await expect(
    page.getByRole("complementary", { name: "Your app summary" })
  ).toContainText("Ready to install");
  await page
    .getByRole("link", { name: "Models & Gateways", exact: true })
    .click();
  await uiVerify.snapshot("stack selections");
  await page.screenshot({ path: testInfo.outputPath("stack-desktop.png") });
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  expect(
    await originalDocument?.evaluate((element) => element.isConnected)
  ).toBe(true);
  await expect(draft).toHaveText("Keep this while configuring my setup");
  await expect(
    panel.getByRole("switch", { name: "Attachment Uploads", exact: true })
  ).toBeChecked();
  await page.getByRole("tab", { name: "AI tools", exact: true }).click();
  await expect(
    tools.getByRole("checkbox", { name: "Get Weather", exact: true })
  ).toBeChecked();
  await tools
    .getByRole("button", { name: "Preview tool examples", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "AI tools", exact: true })
  ).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/item=preview-tools/u);
  await page.reload();
  const selectionQuery = new URL(page.url()).searchParams;
  expect(selectionQuery.get("app")).toMatch(/^a[0-9A-Za-z]+$/u);
  const requested = readInstallationInput(
    selectionQuery.get("app") ?? "",
    selectionQuery.get("storage-config") ?? undefined
  );
  expect(requested.storage?.options.bucket).toBe("my-chat-files");
  expect(requested.plugins).toEqual(["attachment-uploads", "langfuse"]);
  expect(requested.tools).toEqual(["get-weather"]);
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const command = page.getByTestId("create-command");
  await expect(command).toContainText("--app-preset");
  expect(commandAppPreset(await command.textContent()).plugins).toEqual([
    "attachment-uploads",
    "langfuse",
  ]);
  expect(commandAppPreset(await command.textContent()).sandbox).toBe("vercel");
  await expect(command).toContainText('"bucket":"my-chat-files"');
  expect(commandAppPreset(await command.textContent()).tools).toEqual([
    "get-weather",
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
  await page.goto("/create?installation=broken");
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
    `/create?installation=${encodeURIComponent(JSON.stringify({ plugins: ["@chatjs/feedback"], tools: [] }))}`
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
  await expect(
    page.getByRole("complementary", { name: "Your app summary" })
  ).toContainText("Ready to install");
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
  await selectChoice(page, "File storage", "None");
  await expect(
    page
      .getByRole("radiogroup", { name: "File storage" })
      .getByRole("radio", { name: "None" })
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
    await page.getByRole("tab", { name: "AI tools", exact: true }).click();
    await unchangedFrame();
    await uiVerify.snapshot("AI tools panel");
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
    await uiVerify.snapshot("stack");
    await page.screenshot({
      path: testInfo.outputPath("stack.png"),
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page
      .getByRole("link", { name: "Observability", exact: true })
      .click();
    const observability = page.getByRole("region", {
      name: "Observability",
      exact: true,
    });
    await expect(observability.getByRole("heading")).toBeInViewport();
    await observability
      .getByRole("checkbox", { name: "Langfuse", exact: true })
      .check();
    await uiVerify.snapshot("observability");
    await page.screenshot({
      path: testInfo.outputPath("observability.png"),
      animations: "disabled",
    });
    await page.getByRole("link", { name: "Platforms", exact: true }).click();
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
    ).toEqual(["feedback", "langfuse"]);
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
    `/create?installation=${encodeURIComponent(
      JSON.stringify({ gateway: "vercel", plugins: ["feedback"], tools: [] })
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
  await expect(dialog.getByRole("switch")).toHaveAccessibleName(
    "Use pointer on buttons"
  );
  await expect(dialog.getByText("React Aria", { exact: true })).toHaveCount(0);
  await expect(
    dialog.getByRole("group", { name: "Template", exact: true })
  ).toHaveCount(0);
  await uiVerify.snapshot("get code base");
  await page.screenshot({ path: testInfo.outputPath("get-code-base.png") });
  await dialog.getByRole("button", { name: "Radix UI", exact: true }).click();
  await dialog.getByRole("switch", { name: "Use pointer on buttons" }).check();
  await expect(command).toContainText("--base radix --no-rtl --pointer");
  expect(commandAppPreset(await command.textContent()).plugins).toEqual([
    "feedback",
  ]);
  await expect(dialog.getByTestId("app-preset-code")).toHaveText(
    /a[0-9A-Za-z]+/u
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
      `/create?installation=${encodeURIComponent(JSON.stringify(installation))}`
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
    const tools = page.getByRole("region", { name: "AI tools", exact: true });
    const scroll = page
      .getByTestId("tools-scroll")
      .locator('[data-slot="scroll-area-viewport"]');
    const summary = page.getByRole("complementary", {
      name: "Your app summary",
    });
    const geometry = async () =>
      await tools.locator('label[for^="feature-"]').evaluateAll((cards) =>
        cards.map((card) => {
          const rect = card.getBoundingClientRect();
          const container = card.closest('[data-slot="scroll-area-viewport"]');
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
    const beforeSummary = await summaryGeometry();
    await expect(summary).toContainText("Review setup · 1 choice needed");
    await page
      .getByLabel("Storage bucket", { exact: true })
      .fill("preview-files");
    await expect(summary).toContainText("Ready to install");
    expect(await summaryGeometry()).toEqual(beforeSummary);
    await page.getByRole("tab", { name: "AI tools", exact: true }).click();
    const before = await geometry();
    // Each click is explicitly brought into view before measuring: browser scrolling
    // to reach an offscreen control is distinct from a selection shifting the layout.
    for (const checked of [true, false]) {
      const names = [
        "Text Documents",
        "Sheet Documents",
        "Delete Document",
        "Deep Research",
      ];
      for (const name of checked ? names : names.toReversed()) {
        const control = tools.getByRole("checkbox", { name, exact: true });
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
        .getByRole("button", { name: "About Read Document", exact: true })
        .click();
      if (checked) {
        await expect(
          page.getByText(/^Required by .*Text Documents/u)
        ).toBeVisible();
      }
      await page.screenshot({
        path: testInfo.outputPath(`dependencies-${checked}.png`),
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      expect(await geometry()).toEqual(before);
    }
    await page.getByRole("tab", { name: "Setup", exact: true }).click();
    expect(await summaryGeometry()).toEqual(beforeSummary);
    expect(errors).toEqual([]);
  });
}

/* eslint-enable no-await-in-loop */

test("all built-in examples render and document examples open the right editors", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const installation = {
    gateway: "vercel",
    plugins: [],
    sandbox: "vercel",
    storage: { source: "vercel-blob", options: {} },
    tools: [
      "generate-image",
      "generate-video",
      "code-execution",
      "get-weather",
      "word-count",
      "tavily-search",
      "retrieve-url",
      "text-documents",
      "code-documents",
      "sheet-documents",
      "saved-code-execution",
      "deep-research",
      "delete-document",
    ],
  };
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `/create?item=preview-tools&installation=${encodeURIComponent(JSON.stringify(installation))}`
  );
  const preview = page.frameLocator('iframe[title="Preview"]');
  const messages = preview.getByRole("region", {
    name: "Messages",
    exact: true,
  });
  await expect(
    preview.getByRole("button", { name: 'Created "launch.py"', exact: true })
  ).toBeAttached();
  await expect(messages.getByRole("alert")).toHaveCount(0);
  await expect(
    messages.getByText(/not available yet|sample error state/u)
  ).toHaveCount(0);
  await preview
    .getByRole("button", { name: 'Created "launch.py"', exact: true })
    .click();
  const document = preview.getByRole("region", {
    name: "Document",
    exact: true,
  });
  await expect(document).toContainText("Ready to launch!");
  await document.getByRole("button", { name: "Close", exact: true }).click();
  await preview
    .getByRole("button", { name: 'Created "Launch checklist"', exact: true })
    .click();
  await expect(document).toContainText("Design");
  await expect(document).toContainText("In progress");
  await uiVerify.snapshot("sheet example");
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
      tools: ["generate-image", "generate-video", "code-execution"],
    };
    await page.goto(
      `/create?item=preview-tools&installation=${encodeURIComponent(JSON.stringify(installation))}`
    );
    await page.getByRole("tab", { name: "AI tools", exact: true }).click();
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
      preview.getByText("Launch budget", { exact: true })
    ).toBeAttached();
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
    await page.getByRole("tab", { name: "AI tools", exact: true }).click();
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
      tools: ["code-execution"],
      gateway: "vercel",
    };
    await page.goto(
      `/create?installation=${encodeURIComponent(JSON.stringify(installation))}`
    );
    await expect(
      page.frameLocator('iframe[title="Preview"]').getByTestId("chat-preview")
    ).toBeVisible();
    await page.getByRole("tab", { name: "AI tools", exact: true }).click();
    const tools = page.getByRole("region", { name: "AI tools", exact: true });
    await tools
      .getByRole("button", { name: "Choose a sandbox" })
      .scrollIntoViewIfNeeded();
    await expect(
      tools.getByRole("button", { name: "Choose a sandbox" })
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Installation status" })
    ).toContainText("Review setup · 1 choice needed");
    await uiVerify.snapshot("contextual setup action");
    await page.screenshot({
      path: testInfo.outputPath("contextual-setup.png"),
    });
    await tools.getByRole("button", { name: "Choose a sandbox" }).click();
    await expect(
      page.getByRole("radiogroup", { name: "Sandbox", exact: true })
    ).toBeInViewport();
    await page.getByRole("tab", { name: "AI tools", exact: true }).click();
    await expect(
      tools.getByRole("checkbox", { name: "Code Execution", exact: true })
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
    await dialog.getByRole("button", { name: "Choose a sandbox" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("radiogroup", { name: "Sandbox", exact: true })
    ).toBeInViewport();
    await selectChoice(page, "Sandbox", "Vercel Sandbox");
    await page.getByRole("tab", { name: "AI tools", exact: true }).click();
    await expect(
      tools.getByRole("checkbox", { name: "Code Execution", exact: true })
    ).toBeChecked();
    await expect(
      tools.getByRole("button", { name: "Choose a sandbox" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Installation status" })
    ).toContainText("Ready to install");
    await page
      .getByRole("button", { name: "Get Code", exact: true })
      .first()
      .click();
    expect(
      commandAppPreset(await dialog.getByTestId("create-command").textContent())
        .tools
    ).toContain("code-execution");
    await expect(
      dialog.getByRole("button", { name: "Copy Command", exact: true })
    ).toBeEnabled();
    await expect(dialog).toContainText(
      "Add API keys and other credentials after installation."
    );
    await uiVerify.snapshot("ready installation review");
  });
}

for (const width of [1440, 390]) {
  test(`tool cards use content height at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 1000 });
    const installation = {
      plugins: [],
      tools: ["retrieve-url"],
      gateway: "vercel",
    };
    await page.goto(
      `/create?item=preview-tools&installation=${encodeURIComponent(JSON.stringify(installation))}`
    );
    const preview = page.frameLocator('iframe[title="Preview"]');
    const title = preview.getByRole("heading", {
      name: "ChatJS documentation",
      exact: true,
    });
    await expect(title).toBeVisible();
    const card = preview
      .locator(".bg-card.overflow-hidden")
      .filter({ has: title });
    const intro = preview.getByText(
      "Sample results for your selected tools. No external services are called.",
      { exact: true }
    );
    const textBox = await intro.boundingBox();
    const cardBox = await card.boundingBox();
    expect(textBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    if (!textBox || !cardBox) {
      throw new Error("Missing message geometry");
    }
    expect(cardBox.y - (textBox.y + textBox.height)).toBeLessThanOrEqual(40);
    expect(
      await card.evaluate(
        (element) => element.scrollHeight - element.clientHeight
      )
    ).toBeLessThanOrEqual(1);
    await preview.getByText("View content", { exact: true }).click();
    await expect(
      preview.getByText(
        "Choose your appearance, plugins and AI tools, then configure the services that power your app.",
        { exact: true }
      )
    ).toBeVisible();
    expect(
      await card.evaluate(
        (element) => element.scrollHeight - element.clientHeight
      )
    ).toBeLessThanOrEqual(1);
    await uiVerify.snapshot("expanded tool card fits message");
    await page.screenshot({ path: testInfo.outputPath("tool-card.png") });
  });

  test(`setup status fits its summary at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(
      `/create?installation=${encodeURIComponent(JSON.stringify({ plugins: [], tools: ["code-execution"], gateway: "vercel" }))}`
    );
    await page.getByRole("tab", { name: "Setup", exact: true }).click();
    const summary = page.getByRole("complementary", {
      name: "Your app summary",
    });
    const status = summary.getByRole("button", { name: "Setup requirements" });
    await status.scrollIntoViewIfNeeded();
    await expect(status).toContainText("Review setup");
    expect(
      await status.evaluate(
        (element) => element.scrollWidth - element.clientWidth
      )
    ).toBeLessThanOrEqual(1);
    await uiVerify.snapshot("setup status wraps inside summary");
    await page.screenshot({ path: testInfo.outputPath("setup-status.png") });
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
